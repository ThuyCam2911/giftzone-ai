/**
 * RAG Retriever
 * - Nhận câu hỏi → embed (Gemini) → tìm top-k chunks gần nhất trong pgvector
 * - Gọi Claude API với context → trả về câu trả lời + nguồn trích dẫn
 * - Context hội thoại: thay vì nhồi lịch sử thô (dài dần theo số lượt hỏi),
 *   AI tự sinh 1 dòng tóm tắt ẩn ở cuối mỗi câu trả lời, dùng làm context cho
 *   lượt hỏi tiếp theo — giữ prompt gọn, không mất ngữ cảnh sau vài lượt
 */
import { generateText } from '../utils/claude.js';
import { embed } from './embedder.js';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Retriever');

const TOP_K = 5;
const CONTEXT_MARKER = '@@CONTEXT@@';

const SYSTEM_PROMPT = `Bạn là ${process.env.AGENT_NAME ?? 'GiftZone AI'} — AI hỗ trợ đội Sales của GiftZone.

Nhiệm vụ:
- Trả lời câu hỏi của Sales dựa HOÀN TOÀN vào tài liệu được cung cấp
- Nếu không tìm thấy thông tin trong tài liệu → trả lời thẳng thắn: "Tôi chưa có thông tin về vấn đề này trong tài liệu hiện tại."
- KHÔNG bịa đặt hoặc suy đoán ngoài tài liệu
- KHÔNG trích dẫn nguồn hay số thứ tự tài liệu trong câu trả lời
- Trả lời ngắn gọn, súc tích, dễ đọc trên Zalo mobile
- Dùng tiếng Việt, tone thân thiện, chuyên nghiệp
- Nếu câu hỏi mơ hồ → hỏi lại để làm rõ

Sau khi trả lời xong, LUÔN thêm 1 dòng MỚI ở cuối bắt đầu bằng "${CONTEXT_MARKER}" theo sau là bản tóm tắt ngắn gọn (dưới 40 từ, tiếng Việt) về bối cảnh hội thoại tính đến hiện tại (đang hỏi về chủ đề/sản phẩm gì, đã tư vấn những gì) — dòng này CHỈ để hệ thống dùng nội bộ cho câu hỏi tiếp theo của cùng người này, không phải nội dung trả lời cho Sales.`;

// Persona khách hàng (demo showoff nhánh ai-for-demo) — khác SYSTEM_PROMPT ở
// trên (Sales-facing) vì người hỏi ở đây là nông dân/đại lý bên ngoài, không
// phải nhân viên nội bộ: giọng văn thân thiện tư vấn bán hàng, không nhắc "Sales"
const CUSTOMER_SYSTEM_PROMPT = `Bạn là ${process.env.AGENT_NAME ?? 'GiftZone AI'} — trợ lý tư vấn sản phẩm nông dược/thuốc BVTV cho khách hàng của GiftZone.

Nhiệm vụ:
- Tư vấn cho khách (nông dân, đại lý) dựa HOÀN TOÀN vào tài liệu sản phẩm được cung cấp
- Trả lời đúng trọng tâm: công dụng, liều dùng, quy cách, giá, so sánh sản phẩm khi được hỏi
- Nếu không tìm thấy thông tin trong tài liệu → nói thẳng: "Dạ sản phẩm này em chưa có thông tin đầy đủ, để em hỏi lại đội kỹ thuật rồi phản hồi anh/chị nhé."
- KHÔNG bịa đặt hoặc suy đoán ngoài tài liệu, KHÔNG tự đưa ra khuyến cáo pha trộn/liều lượng ngoài tài liệu
- KHÔNG nhắc đến "Sales", "nhân viên", hay các từ nội bộ — khách không cần biết cơ chế hệ thống
- Trả lời ngắn gọn (dưới 7 dòng), dễ đọc trên Zalo mobile, tối đa 1-2 emoji
- Dùng tiếng Việt, xưng "em", gọi khách "anh/chị", tone thân thiện, chuyên nghiệp như nhân viên tư vấn thật
- Nếu câu hỏi mơ hồ → hỏi lại để làm rõ (vd cây trồng gì, diện tích, loại sâu/bệnh gặp phải)

Sau khi trả lời xong, LUÔN thêm 1 dòng MỚI ở cuối bắt đầu bằng "${CONTEXT_MARKER}" theo sau là bản tóm tắt ngắn gọn (dưới 40 từ, tiếng Việt) về bối cảnh hội thoại tính đến hiện tại — dòng này CHỈ để hệ thống dùng nội bộ, không phải nội dung trả lời cho khách.`;

export async function answer(userQuery, contextSummary = '', { audience = 'sales' } = {}) {
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
      context_summary: contextSummary,
    };
  }

  const topScore = chunks[0]?.similarity ?? 0;

  // 3. Build context từ chunks
  const context = chunks
    .map((c, i) => `[${i + 1}] Từ "${c.file_name}":\n${c.content}`)
    .join('\n\n---\n\n');

  const contextBlock = contextSummary
    ? `\nBối cảnh hội thoại trước đó với người này: ${contextSummary}\n`
    : '';

  const prompt = `Tài liệu tham khảo:

${context}
${contextBlock}
---

Câu hỏi của ${audience === 'customer' ? 'khách hàng' : 'Sales'}: ${userQuery}`;

  const raw = await generateText(prompt, {
    system: audience === 'customer' ? CUSTOMER_SYSTEM_PROMPT : SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 650,
  }) ?? 'Có lỗi xảy ra, vui lòng thử lại.';

  // Tách phần trả lời (hiển thị cho user) và dòng tóm tắt ẩn (lưu làm context tiếp theo)
  const markerIdx = raw.lastIndexOf(CONTEXT_MARKER);
  const answerText = (markerIdx === -1 ? raw : raw.slice(0, markerIdx)).trim();
  const newContextSummary = markerIdx === -1
    ? contextSummary // model không tuân thủ format — giữ nguyên context cũ thay vì mất trắng
    : raw.slice(markerIdx + CONTEXT_MARKER.length).trim();

  const sources = [...new Set(chunks.map(c => c.file_name))];
  const latency_ms = Date.now() - start;
  const is_answered = topScore >= 0.5 && !answerText.includes('chưa có thông tin') && !answerText.includes('chưa được cấp tài liệu');

  log.info(`Trả lời trong ${latency_ms}ms, score=${topScore.toFixed(2)}, ${sources.length} nguồn: ${sources.join(', ')}`);

  return { answer: answerText, sources, latency_ms, is_answered, top_score: topScore, context_summary: newContextSummary };
}
