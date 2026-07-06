/**
 * Ops Assistant — trả lời câu hỏi VẬN HÀNH từ database (issues, nhóm, KPI)
 * CHỈ dùng trong nhóm internal — không bao giờ expose dữ liệu này cho khách.
 *
 * Flow: classifyIntent() → 'docs' (fallback về RAG) | 'ops' | 'summary'
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../utils/db.js';
import { fetchMessages, generateSummary } from '../summary/engine.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('OpsAssistant');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ─── Fallback dựa từ khóa — dùng khi Gemini lỗi/quá tải hoặc misclassify ─────
// Free tier gemini-2.5-flash-lite thỉnh thoảng 503 — không được để rơi thẳng
// về "docs" trong trường hợp đó, mất hẳn khả năng trả lời câu hỏi vận hành
const OPS_KEYWORDS = [
  'vấn đề', 'issue', 'còn gì không', 'ai đang', 'phản hồi chậm', 'im lặng',
  'kpi', 'hiệu suất', 'chưa reply', 'chưa trả lời', 'phàn nàn', 'complain',
  'chậm trễ', 'tình hình', 'báo cáo', 'ai làm', 'ai chưa', 'sai gì',
];
const SUMMARY_KEYWORDS = ['tóm tắt', 'tổng hợp', 'recap', 'điểm qua', 'review lại'];

// Từ để hỏi chung (không phải tên nhóm cụ thể) — "nhóm nào", "nhóm gì" v.v.
const GENERIC_WORDS = new Set(['nào', 'gì', 'ai', 'đó', 'này', 'khách']);

function extractGroupNameHeuristic(text) {
  const m = text.match(
    /(?:nhóm|group)\s+([^\s][\s\S]*?)(?:\s+(?:còn|có|đang|bị|không|à|nhé|giúp|thế nào|ra sao|xem|nay|\d)|[?.!]|$)/i
  );
  const name = m?.[1]?.trim() || null;
  if (!name) return null;
  // Loại nếu TOÀN BỘ các từ đều là từ hỏi chung ("gì đó", "nào đó" v.v.)
  const words = name.toLowerCase().split(/\s+/);
  const allGeneric = words.every(w => GENERIC_WORDS.has(w));
  return allGeneric ? null : name;
}

function extractDaysHeuristic(text) {
  const m = text.match(/(\d+)\s*ngày/);
  return m ? Number(m[1]) : null;
}

function heuristicClassify(userQuery) {
  const q = userQuery.toLowerCase();
  const groupName = extractGroupNameHeuristic(userQuery);
  if (SUMMARY_KEYWORDS.some(k => q.includes(k))) {
    return { intent: 'summary', group_name: groupName, days: extractDaysHeuristic(userQuery) };
  }
  if (OPS_KEYWORDS.some(k => q.includes(k))) {
    return { intent: 'ops', group_name: groupName, days: null };
  }
  return { intent: 'docs' };
}

// ─── Bước 1: Phân loại intent ────────────────────────────────────────────────
// Heuristic chạy trước (miễn phí, không gọi API). Chỉ gọi Gemini khi heuristic
// không đủ tự tin — tiết kiệm 1 lệnh gọi/token cho phần lớn câu hỏi ops thực tế
// (người dùng tự nhiên hay dùng đúng các từ khoá như "vấn đề", "tóm tắt"...)
async function classifyWithGemini(userQuery, heuristicHint) {
  const prompt = `Phân loại câu hỏi của nhân viên nội bộ GiftZone vào 1 trong 3 intent:

- "ops": hỏi về tình trạng vận hành — issues/vấn đề của nhóm khách, nhóm nào im lặng, ai phản hồi chậm, KPI nhân viên, tình hình chăm sóc khách
- "summary": yêu cầu tóm tắt nội dung chat của một nhóm (từ khóa: tóm tắt, tổng hợp, recap)
- "docs": hỏi về sản phẩm/chính sách/giá/tài liệu công ty (mặc định nếu không chắc)

Trả về JSON thuần, không markdown:
{"intent":"ops|summary|docs","group_name":"tên nhóm được nhắc đến hoặc null","days":số ngày được nhắc đến hoặc null}

Câu hỏi: "${userQuery.slice(0, 500)}"`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 150 },
    });
    const text = result.response.text().replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);
    if (!['ops', 'summary', 'docs'].includes(parsed.intent)) {
      return heuristicHint;
    }
    // Gemini nói "docs" nhưng câu hỏi có tín hiệu ops/summary rõ ràng → tin heuristic hơn
    // (false negative về RAG docs tệ hơn false positive vào ops — ops vẫn tự nói
    // "chưa đủ dữ liệu" khi không tìm thấy gì, không bịa)
    if (parsed.intent === 'docs' && heuristicHint.intent !== 'docs') {
      return { ...heuristicHint, group_name: parsed.group_name ?? heuristicHint.group_name };
    }
    return parsed;
  } catch (err) {
    log.warn('Classify intent lỗi — dùng keyword fallback:', err.message);
    return heuristicHint;
  }
}

async function classifyIntent(userQuery) {
  const heuristic = heuristicClassify(userQuery);
  // Tự tin: ops (từ khoá vận hành khá rõ nghĩa) hoặc summary có kèm tên nhóm
  const confident = heuristic.intent === 'ops' || (heuristic.intent === 'summary' && heuristic.group_name);
  if (confident) {
    log.debug(`Heuristic fast-path: ${heuristic.intent} — bỏ qua Gemini classify call`);
    return heuristic;
  }
  return classifyWithGemini(userQuery, heuristic);
}

// ─── Resolve tên nhóm → group_id ─────────────────────────────────────────────
async function findGroup(groupName) {
  if (!groupName) return null;
  const { rows } = await query(
    `SELECT group_id, name, group_type FROM group_names
     WHERE name ILIKE $1 AND COALESCE(group_type,'customer') != 'direct'
     ORDER BY LENGTH(name) ASC LIMIT 1`,
    [`%${groupName}%`]
  );
  return rows[0] ?? null;
}

// ─── Gom context vận hành từ DB ──────────────────────────────────────────────
async function buildOpsContext(group) {
  const parts = [];

  if (group) {
    // Context cho 1 nhóm cụ thể
    const [issues, recentMsgs, stats] = await Promise.all([
      query(
        `SELECT issue_type, severity, title, description, evidence, status,
                detected_at, resolved_at
         FROM sales_issues WHERE group_id = $1
         ORDER BY detected_at DESC LIMIT 10`,
        [group.group_id]
      ),
      query(
        `SELECT m.sender_name, m.content, m.msg_ts, m.is_gz_member,
                COALESCE(gz.role, '') AS role
         FROM messages m
         LEFT JOIN gz_members gz ON gz.sender_uid = m.sender_uid
         WHERE m.group_id = $1 AND m.msg_type = 'text'
         ORDER BY m.msg_ts DESC LIMIT 30`,
        [group.group_id]
      ),
      query(
        `SELECT COUNT(*) AS total_7d, MAX(msg_ts) AS last_msg
         FROM messages WHERE group_id = $1 AND msg_ts >= NOW() - INTERVAL '7 days'`,
        [group.group_id]
      ),
    ]);

    parts.push(`NHÓM: "${group.name}" (loại: ${group.group_type ?? 'customer'})`);
    const s = stats.rows[0];
    parts.push(`Tin nhắn 7 ngày qua: ${s.total_7d} — tin cuối: ${s.last_msg ? new Date(s.last_msg).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'chưa có'}`);

    if (issues.rows.length > 0) {
      parts.push(`\nISSUES (mới nhất trước):`);
      for (const i of issues.rows) {
        parts.push(`- [${i.severity}/${i.status}] ${i.issue_type}: ${i.title}`
          + `\n  Mô tả: ${i.description}`
          + (i.evidence ? `\n  Bằng chứng: "${i.evidence}"` : '')
          + `\n  Phát hiện: ${new Date(i.detected_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
      }
    } else {
      parts.push(`\nISSUES: không có issue nào được ghi nhận.`);
    }

    if (recentMsgs.rows.length > 0) {
      parts.push(`\n30 TIN NHẮN GẦN NHẤT (mới nhất trước):`);
      for (const m of recentMsgs.rows) {
        const tag = m.is_gz_member ? `[GZ${m.role ? '-' + m.role : ''}]` : '[KH]';
        const ts = new Date(m.msg_ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        parts.push(`${tag} [${ts}] ${m.sender_name}: ${String(m.content).slice(0, 200)}`);
      }
    }
  } else {
    // Context toàn cục
    const [openIssues, inactive, memberStats] = await Promise.all([
      query(
        `SELECT s.severity, s.issue_type, s.title, s.description, s.evidence,
                gn.name AS group_name, s.detected_at
         FROM sales_issues s
         INNER JOIN group_names gn ON gn.group_id = s.group_id
         WHERE s.status = 'open'
         ORDER BY CASE s.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                  s.detected_at DESC
         LIMIT 15`
      ),
      query(
        `SELECT gn.name, MAX(m.msg_ts) AS last_msg
         FROM messages m
         INNER JOIN group_names gn ON gn.group_id = m.group_id
         WHERE gn.group_type NOT IN ('internal','direct') AND gn.name IS NOT NULL
         GROUP BY gn.name
         HAVING MAX(m.msg_ts) < NOW() - INTERVAL '3 days'
         ORDER BY MAX(m.msg_ts) ASC LIMIT 10`
      ),
      query(
        `SELECT gz.sender_name, gz.role, COUNT(m.id) AS msg_7d
         FROM gz_members gz
         LEFT JOIN messages m ON m.sender_uid = gz.sender_uid
           AND m.msg_ts >= NOW() - INTERVAL '7 days'
         GROUP BY gz.sender_name, gz.role
         ORDER BY msg_7d DESC`
      ),
    ]);

    if (openIssues.rows.length > 0) {
      parts.push(`ISSUES ĐANG MỞ (${openIssues.rows.length}):`);
      for (const i of openIssues.rows) {
        parts.push(`- [${i.severity}] Nhóm "${i.group_name}" — ${i.issue_type}: ${i.title}`
          + `\n  Mô tả: ${i.description}`
          + (i.evidence ? `\n  Bằng chứng: "${i.evidence}"` : ''));
      }
    } else {
      parts.push(`ISSUES ĐANG MỞ: không có.`);
    }

    if (inactive.rows.length > 0) {
      parts.push(`\nNHÓM KHÁCH IM LẶNG >3 NGÀY:`);
      for (const g of inactive.rows) {
        const days = Math.floor((Date.now() - new Date(g.last_msg).getTime()) / 86400000);
        parts.push(`- ${g.name}: ${days} ngày`);
      }
    }

    if (memberStats.rows.length > 0) {
      parts.push(`\nHOẠT ĐỘNG TEAM 7 NGÀY (số tin nhắn):`);
      for (const m of memberStats.rows) {
        parts.push(`- ${m.sender_name} (${m.role}): ${m.msg_7d} tin`);
      }
    }
  }

  return parts.join('\n');
}

// ─── Trả lời câu hỏi ops ─────────────────────────────────────────────────────
async function answerOps(userQuery, groupName) {
  const group = await findGroup(groupName);
  if (groupName && !group) {
    return `Tôi không tìm thấy nhóm nào tên giống "${groupName}". Bạn kiểm tra lại tên nhóm giúp nhé.`;
  }

  const context = await buildOpsContext(group);

  const prompt = `Bạn là AI trợ lý vận hành nội bộ của GiftZone. Trả lời câu hỏi của quản lý dựa HOÀN TOÀN vào dữ liệu vận hành bên dưới.

Quy tắc:
- Trả lời thẳng vào câu hỏi, ngắn gọn, dễ đọc trên Zalo mobile (dưới 10 dòng)
- Khi nói về issue: nêu rõ vấn đề gì, nhóm nào, ai liên quan (dựa vào tag [GZ-*]/[KH] và bằng chứng)
- Nếu dữ liệu không đủ để trả lời → nói thẳng là chưa đủ dữ liệu
- KHÔNG bịa đặt. Tiếng Việt, tone chuyên nghiệp.

<du_lieu_van_hanh>
${context.slice(0, 12000)}
</du_lieu_van_hanh>

Câu hỏi của quản lý: ${userQuery}`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 600 }, // ~10 dòng theo yêu cầu prompt
  });
  return result.response.text() ?? 'Có lỗi xảy ra, vui lòng thử lại.';
}

// ─── Tóm tắt nhóm theo yêu cầu ───────────────────────────────────────────────
async function summarizeOnDemand(groupName, days) {
  if (!groupName) {
    return 'Bạn muốn tóm tắt nhóm nào? Ví dụ: "tóm tắt nhóm Vua nệm 3 ngày qua"';
  }
  const group = await findGroup(groupName);
  if (!group) {
    return `Tôi không tìm thấy nhóm nào tên giống "${groupName}".`;
  }

  const numDays = Math.min(Math.max(Number(days) || 1, 1), 14); // 1–14 ngày
  const since = new Date(Date.now() - numDays * 86400000);
  const messages = await fetchMessages(group.group_id, since);

  if (messages.length < 3) {
    return `Nhóm "${group.name}" chỉ có ${messages.length} tin nhắn trong ${numDays} ngày qua — không đủ để tóm tắt.`;
  }

  const summary = await generateSummary(messages, 'daily');
  return `📋 Tóm tắt nhóm "${group.name}" — ${numDays} ngày qua:\n\n${summary}`;
}

// ─── Entry point ─────────────────────────────────────────────────────────────
/**
 * @returns {Promise<{handled: boolean, answer?: string, intent?: string}>}
 *   handled=false → caller fallback về RAG docs
 */
export async function handleInternalQuery(userQuery) {
  const { intent, group_name, days } = await classifyIntent(userQuery);
  log.info(`Intent: ${intent}${group_name ? ` — nhóm "${group_name}"` : ''}`);

  if (intent === 'ops') {
    const answer = await answerOps(userQuery, group_name);
    return { handled: true, answer, intent };
  }
  if (intent === 'summary') {
    const answer = await summarizeOnDemand(group_name, days);
    return { handled: true, answer, intent };
  }
  return { handled: false, intent: 'docs' };
}
