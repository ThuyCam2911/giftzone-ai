/**
 * Summary Engine
 * - Daily summary 18:00 các ngày làm việc
 * - Weekly summary Thứ 6 17:00
 * - Dùng node-cron + Claude để tổng hợp
 */
import cron from 'node-cron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MessageType } from 'zca-js';
import { query } from '../utils/db.js';
import { getConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Summary');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ─── Lấy tin nhắn trong khoảng thời gian ─────────────────────────────────────
export async function fetchMessages(groupId, since) {
  const result = await query(
    `SELECT sender_name, content, msg_ts
     FROM messages
     WHERE group_id = $1 AND msg_ts >= $2
     ORDER BY msg_ts ASC`,
    [groupId, since]
  );
  return result.rows;
}

// ─── Lấy group IDs nội bộ đang active ────────────────────────────────────────
// CHỈ nhóm internal — summary chứa nhận định nội bộ, không được gửi vào nhóm khách
async function getActiveGroups(since) {
  const result = await query(
    `SELECT DISTINCT m.group_id
     FROM messages m
     INNER JOIN group_names gn ON gn.group_id = m.group_id
     WHERE m.msg_ts >= $1 AND gn.group_type = 'internal'`,
    [since]
  );
  return result.rows.map(r => r.group_id);
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

Cuộc trò chuyện:\n${conversation.slice(0, 8000)}`
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

Cuộc trò chuyện:\n${conversation.slice(0, 8000)}`; // Limit để không vượt context

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1200 }, // prompt yêu cầu "dưới 300 từ"
  });
  return result.response.text();
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
async function runDailySummary(api) {
  log.info('Chạy daily summary...');
  const since = new Date();
  since.setHours(0, 0, 0, 0); // đầu ngày hôm nay

  const groups = await getActiveGroups(since);
  log.info(`${groups.length} groups có hoạt động hôm nay`);

  for (const groupId of groups) {
    const messages = await fetchMessages(groupId, since);
    if (messages.length < 3) continue; // Ít quá, không cần summary

    const summary = await generateSummary(messages, 'daily');
    if (summary) await sendSummary(api, groupId, summary);
  }
}

// ─── Weekly summary job ───────────────────────────────────────────────────────
async function runWeeklySummary(api) {
  log.info('Chạy weekly summary...');
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const groups = await getActiveGroups(since);
  for (const groupId of groups) {
    const messages = await fetchMessages(groupId, since);
    if (messages.length < 10) continue;

    const summary = await generateSummary(messages, 'weekly');
    if (summary) await sendSummary(api, groupId, summary);
  }
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
