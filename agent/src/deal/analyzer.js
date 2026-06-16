/**
 * Deal Intelligence Analyzer
 * - Cron 15 phút: đọc messages → detect deals + stage → lưu DB
 * - Dùng OpenRouter (nvidia/nemotron) tách biệt với Sales Assistant AI
 */
import OpenAI from 'openai';
import cron from 'node-cron';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('DealAI');

const STAGES = ['Mới', 'Tư vấn', 'Thương lượng', 'Chờ chốt', 'Đã chốt', 'Thất bại'];
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY chưa được cấu hình');
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: { 'X-Title': 'GiftZone Deal Intelligence' },
  });
}

// ─── Lấy messages trong 24h gần nhất của group ───────────────────────────────
async function fetchRecentMessages(groupId, sinceHours = 24) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const result = await query(
    `SELECT sender_name, content, msg_ts
     FROM messages
     WHERE group_id = $1 AND msg_ts >= $2
     ORDER BY msg_ts ASC`,
    [groupId, since]
  );
  return result.rows;
}

// ─── Lấy tất cả groups có activity trong 24h ─────────────────────────────────
async function getActiveGroups() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await query(
    `SELECT DISTINCT group_id FROM messages WHERE msg_ts >= $1`,
    [since]
  );
  return result.rows.map(r => r.group_id);
}

// ─── Gọi OpenRouter để phân tích deals ───────────────────────────────────────
async function analyzeDeals(groupId, messages) {
  if (messages.length < 3) return [];

  const conversation = messages
    .map(m => `[${new Date(m.msg_ts).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}] ${m.sender_name}: ${m.content}`)
    .join('\n');

  const prompt = `Bạn là AI phân tích hội thoại bán hàng. Phân tích cuộc trò chuyện dưới đây và xác định các DEAL đang diễn ra.

Mỗi deal là 1 khách hàng cụ thể đang được tư vấn. 1 group có thể có nhiều deal với nhiều khách khác nhau.

Stages hợp lệ: ${STAGES.join(', ')}

Quy tắc xác định stage:
- Mới: khách vừa liên hệ, hỏi thông tin lần đầu
- Tư vấn: đang trao đổi về sản phẩm, nhu cầu, giá
- Thương lượng: đang thảo luận giá, điều khoản, chiết khấu
- Chờ chốt: khách đã đồng ý về cơ bản, chờ xác nhận/thanh toán
- Đã chốt: deal thành công, đã đặt hàng/thanh toán
- Thất bại: khách từ chối hoặc không phản hồi lâu

Trả về JSON array (không có markdown, chỉ JSON thuần):
[
  {
    "deal_key": "tên_khách_viết_liền_không_dấu",
    "customer_name": "tên khách hàng",
    "product": "sản phẩm/dịch vụ quan tâm",
    "stage": "stage hiện tại",
    "confidence": 0.0-1.0,
    "evidence": "đoạn hội thoại ngắn làm bằng chứng xác định stage"
  }
]

Nếu không phát hiện deal nào, trả về [].

Cuộc trò chuyện (group ${groupId}):
${conversation.slice(0, 6000)}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content ?? '[]';

  try {
    // Strip markdown code blocks nếu có
    const json = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const deals = JSON.parse(json);
    return Array.isArray(deals) ? deals : [];
  } catch {
    log.warn(`Parse JSON thất bại cho group ${groupId}:`, text.slice(0, 200));
    return [];
  }
}

// ─── Upsert deal + ghi event nếu stage thay đổi ──────────────────────────────
async function upsertDeal(groupId, deal) {
  const dealKey = `${groupId}__${deal.deal_key}`;

  // Tìm deal hiện tại
  const existing = await query(
    `SELECT id, stage FROM deals WHERE deal_key = $1`,
    [dealKey]
  );
  const prev = existing.rows[0];

  if (!prev) {
    // Tạo deal mới
    const inserted = await query(
      `INSERT INTO deals (group_id, deal_key, customer_name, product, stage, confidence, last_analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [groupId, dealKey, deal.customer_name, deal.product, deal.stage, deal.confidence ?? 0.8]
    );
    const dealId = inserted.rows[0].id;
    await query(
      `INSERT INTO deal_events (deal_id, from_stage, to_stage, evidence) VALUES ($1, NULL, $2, $3)`,
      [dealId, deal.stage, deal.evidence ?? '']
    );
    log.info(`Deal mới: ${deal.customer_name} (${deal.stage}) — group ${groupId}`);
  } else if (prev.stage !== deal.stage) {
    // Stage thay đổi → ghi event
    await query(
      `UPDATE deals SET stage=$1, confidence=$2, last_analyzed_at=NOW(), updated_at=NOW() WHERE id=$3`,
      [deal.stage, deal.confidence ?? 0.8, prev.id]
    );
    await query(
      `INSERT INTO deal_events (deal_id, from_stage, to_stage, evidence) VALUES ($1, $2, $3, $4)`,
      [prev.id, prev.stage, deal.stage, deal.evidence ?? '']
    );
    log.info(`Deal update: ${deal.customer_name} ${prev.stage} → ${deal.stage}`);
  } else {
    // Chỉ update last_analyzed_at
    await query(
      `UPDATE deals SET last_analyzed_at=NOW() WHERE id=$1`,
      [prev.id]
    );
  }
}

// ─── Chạy phân tích cho tất cả groups ────────────────────────────────────────
async function runAnalysis() {
  log.info('Bắt đầu phân tích deals...');
  const groups = await getActiveGroups();
  if (groups.length === 0) { log.info('Không có group nào active'); return; }

  log.info(`Phân tích ${groups.length} groups...`);
  for (const groupId of groups) {
    try {
      const messages = await fetchRecentMessages(groupId);
      const deals = await analyzeDeals(groupId, messages);
      for (const deal of deals) {
        await upsertDeal(groupId, deal);
      }
      log.info(`Group ${groupId}: ${deals.length} deals detected`);
    } catch (err) {
      log.error(`Lỗi phân tích group ${groupId}:`, err.message);
    }
    // Tránh 429 rate limit trên OpenRouter free tier
    await new Promise(r => setTimeout(r, 10000));
  }
  log.info('Phân tích deals hoàn tất');
}

// ─── Khởi động cron ───────────────────────────────────────────────────────────
export function startDealAnalyzer() {
  if (!process.env.OPENROUTER_API_KEY) {
    log.warn('OPENROUTER_API_KEY chưa cấu hình — Deal Intelligence bị tắt');
    return;
  }

  // Chạy mỗi 15 phút
  cron.schedule('*/15 * * * *', () => {
    runAnalysis().catch(err => log.error('Deal analysis crash:', err.message));
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  log.info('Deal Intelligence started — phân tích mỗi 15 phút');
}
