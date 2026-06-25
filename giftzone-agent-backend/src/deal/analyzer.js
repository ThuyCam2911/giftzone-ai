/**
 * Sales Issue Monitor
 * - Cron 15 phút: đọc messages → detect issues chất lượng sales → lưu DB
 * - Auto-resolve: issues không còn detect → tự chuyển status='resolved'
 * - Dùng OpenRouter tách biệt với Sales Assistant AI
 */
import OpenAI from 'openai';
import cron from 'node-cron';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('IssueAI');

// Fallback chain — thử lần lượt khi model trước bị 429
const MODEL_CHAIN = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY chưa được cấu hình');
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: { 'X-Title': 'GiftZone Sales Monitor' },
  });
}

async function callWithFallback(prompt) {
  const client = getClient();
  for (const model of MODEL_CHAIN) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
      });
      log.debug(`Model used: ${model}`);
      return response.choices[0]?.message?.content ?? '[]';
    } catch (err) {
      if (err.status === 429) {
        log.warn(`Model ${model} bị rate limit (429) — thử model tiếp theo...`);
        continue;
      }
      throw err;
    }
  }
  // Ghi trạng thái degraded vào settings để dashboard hiển thị
  try {
    await query(`INSERT INTO settings (key, value, description) VALUES ('analyzer_status','degraded','Trạng thái deal analyzer')
      ON CONFLICT (key) DO UPDATE SET value='degraded', updated_at=NOW()`);
  } catch { /* không crash nếu ghi settings lỗi */ }
  throw new Error('Tất cả models trong fallback chain đều bị rate limit');
}

// ─── Lấy messages mới kể từ lần analyze cuối của group ──────────────────────
async function fetchNewMessages(groupId) {
  const lastRun = await query(
    `SELECT MAX(detected_at) as last FROM sales_issues WHERE group_id = $1`,
    [groupId]
  );
  const since = lastRun.rows[0]?.last ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await query(
    `SELECT sender_uid, sender_name, content, msg_ts
     FROM messages
     WHERE group_id = $1 AND msg_ts > $2
     ORDER BY msg_ts ASC`,
    [groupId, since]
  );
  return result.rows;
}

// ─── Lấy groups có message MỚI kể từ lần analyze cuối ───────────────────────
async function getGroupsWithNewMessages() {
  const result = await query(
    `SELECT DISTINCT m.group_id
     FROM messages m
     LEFT JOIN (
       SELECT group_id, MAX(detected_at) as last_run
       FROM sales_issues
       GROUP BY group_id
     ) s ON m.group_id = s.group_id
     WHERE m.msg_ts > COALESCE(s.last_run, NOW() - INTERVAL '24 hours')
       AND m.group_id NOT IN (
         SELECT group_id FROM group_names WHERE group_type = 'internal'
       )`
  );
  return result.rows.map(r => r.group_id);
}

// ─── Gọi OpenRouter để phát hiện issues ──────────────────────────────────────
async function detectIssues(groupId, messages) {
  if (messages.length < 5) return [];

  const now = new Date().toISOString();

  // Load GZ members với role — nếu bảng rỗng thì không tag role (behavior giống cũ)
  const gzRows = await query(`SELECT sender_uid, role FROM gz_members`);
  const gzMap = new Map(gzRows.rows.map(r => [r.sender_uid, r.role ?? 'sales']));
  const hasGzConfig = gzMap.size > 0;

  const ROLE_LABEL = { sales: 'GZ-Sales', cs: 'GZ-CS', manager: 'GZ-Manager', technical: 'GZ-Tech' };

  const conversation = messages
    .map(m => {
      const ts = new Date(m.msg_ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      let tag = '';
      if (hasGzConfig) {
        const role = gzMap.get(m.sender_uid);
        tag = role ? `[${ROLE_LABEL[role] ?? 'GZ'}]` : '[KH]';
      }
      return `${tag}[${ts}] ${m.sender_name}: ${m.content}`;
    })
    .join('\n');

  const roleRules = hasGzConfig ? `
Phân loại người tham gia:
- [GZ-Sales] = nhân viên Sales GiftZone
- [GZ-CS] = nhân viên Customer Success GiftZone
- [GZ-Manager] = quản lý GiftZone
- [GZ-Tech] = nhân viên kỹ thuật GiftZone
- [KH] = khách hàng

Quy tắc bổ sung:
- Chỉ report no_reply hoặc dropped_conversation khi [KH] nhắn và GZ chưa có reply
- Nếu các tin nhắn cuối đều là [KH] nói chuyện với nhau (không có câu hỏi hướng đến GZ) → KHÔNG flag no_reply hay dropped_conversation
- slow_reply, rude_behavior, broken_promise chỉ áp dụng cho nhân viên GZ
` : '';

  const prompt = `Bạn là AI giám sát chất lượng đội ngũ sales (theo mô hình WeCom). Phân tích hội thoại dưới đây và phát hiện CÁC VẤN ĐỀ đang xảy ra.

Timestamp hiện tại: ${now}
${roleRules}
Issue types được phép dùng:
- no_reply: khách đã hỏi nhưng sales chưa reply (dựa vào thứ tự tin nhắn cuối)
- slow_reply: khoảng cách reply của sales > 24 giờ (tính từ timestamp)
- rude_behavior: sales dùng ngôn ngữ cọc cằn, thiếu tôn trọng, lạnh lùng bất thường
- customer_complaint: khách bày tỏ bất mãn, phàn nàn về sản phẩm hoặc thái độ
- broken_promise: sales nói "sẽ gửi", "để kiểm tra", "sẽ liên hệ lại" nhưng không có tin tiếp theo
- missed_opportunity: khách hỏi giá hoặc sản phẩm cụ thể nhưng sales không gửi báo giá hoặc không chốt
- dropped_conversation: hội thoại dừng đột ngột khi đang tư vấn, không có kết luận
- low_engagement: sales trả lời rất ngắn ("ok", "vâng") hoặc không đúng trọng tâm câu hỏi
- negative_sentiment: cảm xúc tiêu cực rõ ràng từ sales hoặc khách (bực bội, thất vọng)

Quy tắc:
- Chỉ report issue khi có bằng chứng rõ trong đoạn chat
- Không đoán mò khi không đủ ngữ cảnh
- Mỗi issue_type chỉ report 1 lần dù có nhiều bằng chứng

Trả về JSON array (không có markdown, chỉ JSON thuần):
[{
  "issue_type": "...",
  "severity": "low|medium|high|critical",
  "title": "1 câu mô tả ngắn bằng tiếng Việt",
  "description": "giải thích tại sao đây là vấn đề",
  "evidence": "copy nguyên văn đoạn chat làm bằng chứng (tối đa 200 ký tự)"
}]

Nếu không có vấn đề, trả về [].

Cuộc trò chuyện (group ${groupId}):
<conversation>
${conversation.slice(0, 6000)}
</conversation>`;

  const text = await callWithFallback(prompt);

  try {
    const json = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const issues = JSON.parse(json);
    return Array.isArray(issues) ? issues : [];
  } catch {
    log.warn(`Parse JSON thất bại cho group ${groupId}:`, text.slice(0, 200));
    return [];
  }
}

// ─── Upsert issue ─────────────────────────────────────────────────────────────
async function upsertIssue(groupId, issue) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const issueKey = `${groupId}__${issue.issue_type}__${today}`;

  const existing = await query(
    `SELECT id, status FROM sales_issues WHERE issue_key = $1`,
    [issueKey]
  );
  const prev = existing.rows[0];

  if (!prev) {
    await query(
      `INSERT INTO sales_issues (group_id, issue_key, issue_type, severity, title, description, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [groupId, issueKey, issue.issue_type, issue.severity ?? 'medium',
       issue.title, issue.description ?? '', issue.evidence ?? '']
    );
    log.info(`Issue mới: [${issue.severity}] ${issue.issue_type} — group ${groupId}`);
  } else if (prev.status === 'open') {
    await query(
      `UPDATE sales_issues SET evidence=$1, description=$2, updated_at=NOW() WHERE id=$3`,
      [issue.evidence ?? '', issue.description ?? '', prev.id]
    );
  }
  // Nếu đã resolved → bỏ qua (không reopen)
}

// ─── Auto-resolve: issues không còn detect trong lần này ─────────────────────
async function autoResolve(groupId, detectedTypes) {
  const openIssues = await query(
    `SELECT id, issue_type FROM sales_issues WHERE group_id = $1 AND status = 'open'`,
    [groupId]
  );
  for (const row of openIssues.rows) {
    if (!detectedTypes.includes(row.issue_type)) {
      await query(
        `UPDATE sales_issues SET status='resolved', resolved_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [row.id]
      );
      log.info(`Auto-resolved: ${row.issue_type} — group ${groupId}`);
    }
  }
}

// ─── Chạy phân tích cho tất cả groups ────────────────────────────────────────
async function runAnalysis() {
  log.info('Bắt đầu phân tích issues...');
  const groups = await getGroupsWithNewMessages();
  if (groups.length === 0) { log.info('Không có group nào có message mới'); return; }

  log.info(`Phân tích ${groups.length} groups có message mới...`);
  for (const groupId of groups) {
    try {
      const messages = await fetchNewMessages(groupId);
      const issues = await detectIssues(groupId, messages);
      for (const issue of issues) {
        await upsertIssue(groupId, issue);
      }
      const detectedTypes = issues.map(i => i.issue_type);
      // Chỉ auto-resolve khi có đủ messages để phân tích (tránh resolve nhầm vì thiếu data)
      if (messages.length >= 5) {
        await autoResolve(groupId, detectedTypes);
      }
      log.info(`Group ${groupId}: ${issues.length} issues detected`);
    } catch (err) {
      log.error(`Lỗi phân tích group ${groupId}:`, err.message);
    }
    // Tránh 429 rate limit trên OpenRouter free tier
    await new Promise(r => setTimeout(r, 60000));
  }
  log.info('Phân tích issues hoàn tất');
}

// ─── Khởi động cron ───────────────────────────────────────────────────────────
export function startDealAnalyzer() {
  if (!process.env.OPENROUTER_API_KEY) {
    log.warn('OPENROUTER_API_KEY chưa cấu hình — Sales Monitor bị tắt');
    return;
  }

  cron.schedule('*/15 * * * *', () => {
    runAnalysis().catch(err => log.error('Issue analysis crash:', err.message));
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  log.info('Sales Issue Monitor started — phân tích mỗi 15 phút');
}
