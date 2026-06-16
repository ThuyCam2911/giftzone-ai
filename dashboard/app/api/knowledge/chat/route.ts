import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const AGENT_NAME = process.env.AGENT_NAME ?? 'GiftZone AI';

const SYSTEM_PROMPT = `Bạn là ${AGENT_NAME} — AI hỗ trợ đội Sales của GiftZone.

Nhiệm vụ:
- Trả lời câu hỏi dựa HOÀN TOÀN vào tài liệu được cung cấp
- Nếu không tìm thấy thông tin → trả lời: "Tôi chưa có thông tin về vấn đề này trong tài liệu hiện tại."
- KHÔNG bịa đặt hoặc suy đoán ngoài tài liệu
- KHÔNG trích dẫn nguồn hay số thứ tự tài liệu trong câu trả lời
- Trả lời ngắn gọn, súc tích, dùng tiếng Việt`;

async function embed(text: string): Promise<number[]> {
  const embModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (embModel as any).embedContent({
    content: { role: 'user', parts: [{ text: text.slice(0, 8000) }] },
    outputDimensionality: 1536,
  });
  return result.embedding.values;
}

export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: 'Thiếu câu hỏi' }, { status: 400 });

  const start = Date.now();

  const queryVec = await embed(question);

  const chunks = await query<{ file_name: string; content: string; similarity: number }>(
    `SELECT file_name, content, 1 - (embedding <=> $1::vector(1536)) AS similarity
     FROM doc_chunks
     ORDER BY embedding <=> $1::vector(1536)
     LIMIT 5`,
    [JSON.stringify(queryVec)]
  );

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: '⚠️ Chưa có tài liệu nào được index. Chạy lại index từ agent.',
      sources: [],
      latency_ms: Date.now() - start,
    });
  }

  const context = chunks
    .map((c, i) => `[${i + 1}] Từ "${c.file_name}":\n${c.content}`)
    .join('\n\n---\n\n');

  const prompt = `${SYSTEM_PROMPT}\n\nTài liệu tham khảo:\n\n${context}\n\n---\n\nCâu hỏi: ${question}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent(prompt);
  const answer = result.response.text();
  const sources = [...new Set(chunks.map(c => c.file_name))];

  return NextResponse.json({ answer, sources, latency_ms: Date.now() - start });
}
