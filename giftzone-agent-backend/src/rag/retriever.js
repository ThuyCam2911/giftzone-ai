/**
 * RAG Retriever
 * - Nhận câu hỏi → embed → tìm top-k chunks gần nhất trong pgvector
 * - Gọi Gemini API với context → trả về câu trả lời + nguồn trích dẫn
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { embed } from './embedder.js';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Retriever');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const TOP_K = 5;

const SYSTEM_PROMPT = `Bạn là ${process.env.AGENT_NAME ?? 'GiftZone AI'} — AI hỗ trợ đội Sales của GiftZone.

Nhiệm vụ:
- Trả lời câu hỏi của Sales dựa HOÀN TOÀN vào tài liệu được cung cấp
- Nếu không tìm thấy thông tin trong tài liệu → trả lời thẳng thắn: "Tôi chưa có thông tin về vấn đề này trong tài liệu hiện tại."
- KHÔNG bịa đặt hoặc suy đoán ngoài tài liệu
- KHÔNG trích dẫn nguồn hay số thứ tự tài liệu trong câu trả lời
- Trả lời ngắn gọn, súc tích, dễ đọc trên Zalo mobile
- Dùng tiếng Việt, tone thân thiện, chuyên nghiệp
- Nếu câu hỏi mơ hồ → hỏi lại để làm rõ`;

export async function answer(userQuery, history = []) {
  const start = Date.now();
  log.info(`Query: "${userQuery}"`);

  // 1. Embed câu hỏi
  const queryVec = await embed(userQuery);

  // 2. Tìm top-k chunks gần nhất
  const { rows: chunks } = await query(
    `SELECT file_name, content, 1 - (embedding <=> $1::vector(1536)) AS similarity
     FROM doc_chunks
     ORDER BY embedding <=> $1::vector(1536)
     LIMIT $2`,
    [JSON.stringify(queryVec), TOP_K]
  );

  if (chunks.length === 0) {
    log.warn('Không có chunks trong DB — cần chạy npm run index:drive trước');
    return {
      answer: '⚠️ Tôi chưa được cấp tài liệu nào để tra cứu. Vui lòng liên hệ Manager để cập nhật tài liệu.',
      sources: [],
      latency_ms: Date.now() - start,
      is_answered: false,
      top_score: 0,
    };
  }

  const topScore = chunks[0]?.similarity ?? 0;

  // 3. Build context từ chunks
  const context = chunks
    .map((c, i) => `[${i + 1}] Từ "${c.file_name}":\n${c.content}`)
    .join('\n\n---\n\n');

  // 4. Gọi Gemini (kèm lịch sử hỏi-đáp gần nhất nếu có — cho phép hỏi nối trong 1:1)
  const historyBlock = history.length > 0
    ? `\nLịch sử hỏi-đáp gần đây với người này (để hiểu ngữ cảnh câu hỏi nối):\n`
      + history.map(h => `Hỏi: ${h.query}\nĐáp: ${String(h.answer).slice(0, 300)}`).join('\n---\n')
      + '\n'
    : '';

  const prompt = `${SYSTEM_PROMPT}

Tài liệu tham khảo:

${context}
${historyBlock}
---

Câu hỏi của Sales: ${userQuery}`;

  const result = await model.generateContent(prompt);
  const answerText = result.response.text() ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  const sources = [...new Set(chunks.map(c => c.file_name))];
  const latency_ms = Date.now() - start;
  const is_answered = topScore >= 0.5 && !answerText.includes('chưa có thông tin') && !answerText.includes('chưa được cấp tài liệu');

  log.info(`Trả lời trong ${latency_ms}ms, score=${topScore.toFixed(2)}, ${sources.length} nguồn: ${sources.join(', ')}`);

  return { answer: answerText, sources, latency_ms, is_answered, top_score: topScore };
}
