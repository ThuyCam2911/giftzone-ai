/**
 * Summary Engine
 * - Daily summary 18:00 các ngày làm việc
 * - Weekly summary Thứ 6 17:00
 * - Dùng node-cron + Claude để tổng hợp
 */
import cron from 'node-cron';
import { generateText } from '../utils/claude.js';
import { MessageType } from 'zca-js';
import { query } from '../utils/db.js';
import { getConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Summary');

// Giới hạn ký tự đưa vào prompt tóm tắt — Claude Haiku 4.5 có context window
// 200k token (~800k ký tự), 8000 ký tự cũ (~1600 từ) quá thấp so với khả năng
// thật, cắt mất nửa sau của những ngày chat nhiều (đã gặp thực tế: 65 tin nhắn
// ~12.8k ký tự chỉ tóm tắt được 33/65 tin đầu, bỏ hẳn nửa cuối ngày). Nâng lên
// mức vẫn rất an toàn so với context window nhưng đủ cho cả ngày chat sôi nổi.
const CONVERSATION_CHAR_LIMIT = 60000;

// ─── Lấy tin nhắn trong khoảng thời gian ─────────────────────────────────────
export async function fetchMessages(groupId, since, until = null) {
  const result = await query(
    until
      ? `SELECT sender_name, content, msg_ts FROM messages
         WHERE group_id = $1 AND msg_ts >= $2 AND msg_ts <= $3
         ORDER BY msg_ts ASC`
      : `SELECT sender_name, content, msg_ts FROM messages
         WHERE group_id = $1 AND msg_ts >= $2
         ORDER BY msg_ts ASC`,
    until ? [groupId, since, until] : [groupId, since]
  );
  return result.rows;
}

// ─── Ngày theo giờ Việt Nam — dùng để tách raw chat "hôm nay" khỏi các ngày đã
// chốt (đã có summary lưu sẵn), tránh phụ thuộc timezone của server (VPS chạy UTC)
export function todayVN(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000)
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }); // "YYYY-MM-DD"
}

export function startOfDayVN(dateStr = todayVN()) {
  return new Date(`${dateStr}T00:00:00+07:00`);
}

function endOfDayVN(dateStr) {
  return new Date(`${dateStr}T23:59:59+07:00`);
}

// ─── Tóm tắt "hôm nay" — luôn tươi từ raw messages, KHÔNG cache (ngày chưa kết
// thúc nên chưa chốt được nội dung) ──────────────────────────────────────────
export async function buildTodaySummary(groupId) {
  const messages = await fetchMessages(groupId, startOfDayVN());
  if (messages.length < 3) return null;
  return generateSummary(messages, 'daily');
}

// ─── Tóm tắt 1 ngày đã qua — ưu tiên đọc từ cache `group_daily_summaries`, chỉ
// đọc lại raw messages của đúng ngày đó khi chưa có cache. Tiết kiệm token khi
// người dùng hỏi tóm tắt nhiều ngày: không gộp raw chat của các ngày trước vào
// 1 lượt gọi AI như trước, mỗi ngày chỉ tóm tắt 1 lần rồi lưu lại dùng mãi ──────
export async function getOrBuildDailySummary(groupId, dateStr) {
  const cached = await query(
    `SELECT summary FROM group_daily_summaries WHERE group_id = $1 AND summary_date = $2`,
    [groupId, dateStr]
  );
  if (cached.rows[0]) return cached.rows[0].summary;

  const messages = await fetchMessages(groupId, startOfDayVN(dateStr), endOfDayVN(dateStr));
  if (messages.length < 3) return null;

  const summary = await generateSummary(messages, 'daily');
  if (summary) {
    await query(
      `INSERT INTO group_daily_summaries (group_id, summary_date, summary)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, summary_date) DO UPDATE SET summary = $3`,
      [groupId, dateStr, summary]
    );
  }
  return summary;
}

// ─── Tạo summary bằng Claude ──────────────────────────────────────────────────
export async function generateSummary(messages, type = 'daily') {
  if (messages.length === 0) return null;

  const conversation = messages
    .map(m => `[${new Date(m.msg_ts).toLocaleTimeString('vi-VN')}] ${m.sender_name}: ${m.content}`)
    .join('\n');

  const prompt = type === 'daily'
    ? `Tổng hợp cuộc trò chuyện sales hôm nay thành báo cáo ngắn gọn (dưới 300 từ) theo format:

📊 *DAILY SUMMARY — ${new Date().toLocaleDateString('vi-VN')}*

🔑 *Điểm chính hôm nay:*
• [bullet points]

💬 *Câu hỏi Sales đã hỏi Agent:*
• [list các câu hỏi quan trọng]

✅ *Việc cần follow-up:*
• [action items nếu có]

😊 *Sentiment chung:* [tích cực/trung tính/cần chú ý]

Cuộc trò chuyện:\n${conversation.slice(0, CONVERSATION_CHAR_LIMIT)}`
    : `Tổng hợp tuần này thành weekly report theo format:

📈 *WEEKLY SUMMARY — Tuần ${getWeekNumber()}*

📊 *Tổng quan:*
• Số tin nhắn: ${messages.length}
• Khoảng thời gian: [từ ... đến ...]

🏆 *Highlights tuần:*
• [top 3-5 điểm nổi bật]

❓ *Câu hỏi thường gặp:*
• [pattern câu hỏi Sales hay hỏi]

⚠️ *Cần chú ý:*
• [vấn đề cần Manager xem xét]

Cuộc trò chuyện:\n${conversation.slice(0, CONVERSATION_CHAR_LIMIT)}`;

  return generateText(prompt, { temperature: 0.4, maxTokens: 1200 }); // prompt yêu cầu "dưới 300 từ"
}

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

// ─── Gửi summary vào group ────────────────────────────────────────────────────
async function sendSummary(api, groupId, text) {
  try {
    await api.sendMessage({ msg: text }, groupId, MessageType.GroupMessage);
    log.info(`Summary đã gửi vào group ${groupId}`);
  } catch (err) {
    log.error(`Gửi summary thất bại cho group ${groupId}`, err.message);
  }
}

// ─── Daily summary job ────────────────────────────────────────────────────────
// Chỉ gửi vào 1 nhóm monitoring duy nhất (không phát cho mọi nhóm internal đang active)
async function runDailySummary(api) {
  log.info('Chạy daily summary...');
  const since = new Date();
  since.setHours(0, 0, 0, 0); // đầu ngày hôm nay

  const groupId = getConfig('daily_summary_group_id', process.env.DAILY_SUMMARY_GROUP_ID ?? '5666015708994110958');

  const messages = await fetchMessages(groupId, since);
  if (messages.length < 3) {
    log.info('Không đủ tin nhắn để tạo daily summary');
    return;
  }

  const summary = await generateSummary(messages, 'daily');
  if (summary) await sendSummary(api, groupId, summary);
}

// ─── Weekly summary job ───────────────────────────────────────────────────────
// Chỉ gửi vào 1 nhóm monitoring duy nhất, giống daily summary (không phát cho mọi nhóm internal đang active)
async function runWeeklySummary(api) {
  log.info('Chạy weekly summary...');
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const groupId = getConfig('daily_summary_group_id', process.env.DAILY_SUMMARY_GROUP_ID ?? '5666015708994110958');

  const messages = await fetchMessages(groupId, since);
  if (messages.length < 10) {
    log.info('Không đủ tin nhắn để tạo weekly summary');
    return;
  }

  const summary = await generateSummary(messages, 'weekly');
  if (summary) await sendSummary(api, groupId, summary);
}

// ─── Khởi động schedulers ─────────────────────────────────────────────────────
export function startSummaryEngine(api) {
  // Daily summary: 18:00 các ngày làm việc (Mon–Fri)
  const dailyCron = getConfig('summary_cron', process.env.SUMMARY_CRON ?? '0 18 * * 1-5');
  cron.schedule(dailyCron, () => {
    runDailySummary(api).catch(err => log.error('Daily summary crash', err.message));
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // Weekly summary: Thứ 6 17:00
  cron.schedule('0 17 * * 5', () => {
    runWeeklySummary(api).catch(err => log.error('Weekly summary crash', err.message));
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  log.info(`Summary engine started — daily: "${dailyCron}", weekly: Thứ 6 17:00`);
}
