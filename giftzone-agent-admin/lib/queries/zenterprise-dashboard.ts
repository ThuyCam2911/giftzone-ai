import { query } from '@/lib/db';
import { ensureZEnterpriseTable, type ZEnterpriseAccount } from './zenterprise';

export interface ZDashOverview {
  conversations: number;
  messages: number;
  aiQueries: number;
  openIssues: number;
  storesActive: number;
  distinctCustomers: number;
  daysChart: { label: string; count: number }[];
}

export interface ZDashChatbot {
  aiReplies: number;
  humanReplies: number;
  unanswered: number;
  unansweredTotal: number;
  avgResponseMin: number | null;
  questionTypes: { type: string; count: number }[];
}

export interface ZDashIssueType {
  issue_type: string;
  count: number;
}

export interface ZDashStoreRow {
  branch: string;
  customers: number;
  messages: number;
  aiReplies: number;
  humanReplies: number;
  openIssues: number;
}

export interface ZDashMonitor {
  issueTypes: ZDashIssueType[];
  stores: ZDashStoreRow[];
}

export interface ZDashAccountRow {
  id: number;
  account_name: string;
  branch: string | null;
  role: string;
  linked: boolean;
  messages: number;
  ai_queries: number;
  open_issues: number;
  quality_score: number | null; // avg sales_issues-based score across their groups, null if no data
}

function toVNDateKey(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export async function getZDashOverview(from: string, to: string): Promise<ZDashOverview> {
  const fromTs = new Date(`${from}T00:00:00+07:00`);
  const toTs   = new Date(`${to}T23:59:59+07:00`);

  const [conv, msgs, aiQ, issues, chart, stores, customers] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT m.group_id) AS count
       FROM messages m
       LEFT JOIN group_names gn ON gn.group_id = m.group_id
       WHERE m.msg_ts >= $1 AND m.msg_ts <= $2
         AND COALESCE(gn.group_type,'customer') NOT IN ('internal','direct')`,
      [fromTs, toTs],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages WHERE msg_ts >= $1 AND msg_ts <= $2`,
      [fromTs, toTs],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ai_logs WHERE created_at >= $1 AND created_at <= $2`,
      [fromTs, toTs],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM sales_issues WHERE status = 'open' AND detected_at >= $1 AND detected_at <= $2`,
      [fromTs, toTs],
    ),
    query<{ day: string; count: string }>(
      `SELECT TO_CHAR(msg_ts AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM messages WHERE msg_ts >= $1 AND msg_ts <= $2
       GROUP BY day ORDER BY day`,
      [fromTs, toTs],
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT branch) AS count FROM group_names WHERE branch IS NOT NULL AND branch != ''`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT m.sender_uid) AS count
       FROM messages m
       LEFT JOIN group_names gn ON gn.group_id = m.group_id
       WHERE m.responder_type = 'customer' AND m.msg_ts >= $1 AND m.msg_ts <= $2
         AND COALESCE(gn.group_type,'customer') NOT IN ('internal')`,
      [fromTs, toTs],
    ),
  ]);

  const chartMap = Object.fromEntries(chart.map(r => [r.day, Number(r.count)]));
  const fromDate = new Date(`${from}T00:00:00+07:00`);
  const toDate   = new Date(`${to}T00:00:00+07:00`);
  const diffDays = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
  const maxBars  = Math.min(diffDays + 1, 30);
  const step     = Math.ceil((diffDays + 1) / maxBars);
  const daysChart: { label: string; count: number }[] = [];
  for (let i = 0; i <= diffDays; i += step) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const key = toVNDateKey(d);
    daysChart.push({
      label: diffDays <= 7
        ? d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
        : d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }),
      count: chartMap[key] ?? 0,
    });
  }

  return {
    conversations: Number(conv[0]?.count ?? 0),
    messages: Number(msgs[0]?.count ?? 0),
    aiQueries: Number(aiQ[0]?.count ?? 0),
    openIssues: Number(issues[0]?.count ?? 0),
    storesActive: Number(stores[0]?.count ?? 0),
    distinctCustomers: Number(customers[0]?.count ?? 0),
    daysChart,
  };
}

// Section "AI Chatbot": AI vs người thật trả lời, tỉ lệ chưa trả lời được, thời gian phản hồi,
// và phân loại loại câu hỏi khách hỏi (order/promotion/complaint/info/other)
export async function getZDashChatbot(from: string, to: string): Promise<ZDashChatbot> {
  const fromTs = new Date(`${from}T00:00:00+07:00`);
  const toTs   = new Date(`${to}T23:59:59+07:00`);

  const [replyCounts, unanswered, avgResponse, questionTypes] = await Promise.all([
    query<{ responder_type: string; count: string }>(
      `SELECT responder_type, COUNT(*) AS count FROM messages
       WHERE responder_type IN ('ai','human') AND msg_ts >= $1 AND msg_ts <= $2
       GROUP BY responder_type`,
      [fromTs, toTs],
    ),
    query<{ unanswered: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE is_answered = false) AS unanswered, COUNT(*) AS total
       FROM ai_logs WHERE created_at >= $1 AND created_at <= $2`,
      [fromTs, toTs],
    ),
    query<{ avg_min: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (m.msg_ts - prev_cust.msg_ts)) / 60)::numeric(10,1) AS avg_min
       FROM messages m
       JOIN LATERAL (
         SELECT MAX(msg2.msg_ts) AS msg_ts FROM messages msg2
         WHERE msg2.group_id = m.group_id AND msg2.msg_ts < m.msg_ts AND msg2.responder_type = 'customer'
       ) prev_cust ON true
       WHERE m.responder_type = 'ai' AND m.msg_ts >= $1 AND m.msg_ts <= $2`,
      [fromTs, toTs],
    ),
    query<{ type: string; count: string }>(
      `SELECT COALESCE(question_type, 'other') AS type, COUNT(*) AS count
       FROM messages WHERE responder_type = 'customer' AND msg_ts >= $1 AND msg_ts <= $2
       GROUP BY type ORDER BY count DESC`,
      [fromTs, toTs],
    ),
  ]);

  const byType = Object.fromEntries(replyCounts.map(r => [r.responder_type, Number(r.count)]));

  return {
    aiReplies: byType['ai'] ?? 0,
    humanReplies: byType['human'] ?? 0,
    unanswered: Number(unanswered[0]?.unanswered ?? 0),
    unansweredTotal: Number(unanswered[0]?.total ?? 0),
    avgResponseMin: avgResponse[0]?.avg_min != null ? Number(avgResponse[0].avg_min) : null,
    questionTypes: questionTypes.map(r => ({ type: r.type, count: Number(r.count) })),
  };
}

// Section "Monitor": issue breakdown + số liệu theo từng chi nhánh/cửa hàng (group_names.branch)
export async function getZDashMonitor(from: string, to: string): Promise<ZDashMonitor> {
  const fromTs = new Date(`${from}T00:00:00+07:00`);
  const toTs   = new Date(`${to}T23:59:59+07:00`);

  const [issueTypes, stores] = await Promise.all([
    query<{ issue_type: string; count: string }>(
      `SELECT issue_type, COUNT(*) AS count FROM sales_issues
       WHERE status = 'open' AND detected_at >= $1 AND detected_at <= $2
       GROUP BY issue_type ORDER BY count DESC`,
      [fromTs, toTs],
    ),
    query<{ branch: string; customers: string; messages: string; ai_replies: string; human_replies: string; open_issues: string }>(
      `SELECT
         gn.branch,
         COUNT(DISTINCT m.sender_uid) FILTER (WHERE m.responder_type = 'customer') AS customers,
         COUNT(*) FILTER (WHERE m.responder_type = 'customer') AS messages,
         COUNT(*) FILTER (WHERE m.responder_type = 'ai') AS ai_replies,
         COUNT(*) FILTER (WHERE m.responder_type = 'human') AS human_replies,
         (SELECT COUNT(*) FROM sales_issues si
            WHERE si.status = 'open' AND si.group_id IN (
              SELECT group_id FROM group_names WHERE branch = gn.branch
            )) AS open_issues
       FROM messages m
       JOIN group_names gn ON gn.group_id = m.group_id
       WHERE gn.branch IS NOT NULL AND gn.branch != ''
         AND m.msg_ts >= $1 AND m.msg_ts <= $2
       GROUP BY gn.branch
       ORDER BY messages DESC`,
      [fromTs, toTs],
    ),
  ]);

  return {
    issueTypes: issueTypes.map(r => ({ issue_type: r.issue_type, count: Number(r.count) })),
    stores: stores.map(r => ({
      branch: r.branch,
      customers: Number(r.customers),
      messages: Number(r.messages),
      aiReplies: Number(r.ai_replies),
      humanReplies: Number(r.human_replies),
      openIssues: Number(r.open_issues),
    })),
  };
}

export async function getZDashAccounts(from: string, to: string): Promise<ZDashAccountRow[]> {
  await ensureZEnterpriseTable();
  const accounts = await query<ZEnterpriseAccount>(
    `SELECT id, account_name, branch, role, linked_sender_uid FROM zenterprise_accounts ORDER BY created_at ASC`,
  );
  if (accounts.length === 0) return [];

  const fromTs = new Date(`${from}T00:00:00+07:00`);
  const toTs   = new Date(`${to}T23:59:59+07:00`);

  const rows = await Promise.all(accounts.map(async (a): Promise<ZDashAccountRow> => {
    if (!a.linked_sender_uid) {
      return {
        id: a.id, account_name: a.account_name, branch: a.branch, role: a.role,
        linked: false, messages: 0, ai_queries: 0, open_issues: 0, quality_score: null,
      };
    }
    const [msgs, aiQ, groupIds] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM messages WHERE sender_uid = $1 AND msg_ts >= $2 AND msg_ts <= $3`,
        [a.linked_sender_uid, fromTs, toTs],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ai_logs WHERE sender_uid = $1 AND created_at >= $2 AND created_at <= $3`,
        [a.linked_sender_uid, fromTs, toTs],
      ),
      query<{ group_id: string }>(
        `SELECT DISTINCT group_id FROM messages WHERE sender_uid = $1 AND msg_ts >= $2 AND msg_ts <= $3`,
        [a.linked_sender_uid, fromTs, toTs],
      ),
    ]);

    const ids = groupIds.map(g => g.group_id);
    let openIssues = 0;
    if (ids.length > 0) {
      const issueRows = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM sales_issues WHERE status = 'open' AND group_id = ANY($1::text[])`,
        [ids],
      );
      openIssues = Number(issueRows[0]?.count ?? 0);
    }

    return {
      id: a.id, account_name: a.account_name, branch: a.branch, role: a.role,
      linked: true,
      messages: Number(msgs[0]?.count ?? 0),
      ai_queries: Number(aiQ[0]?.count ?? 0),
      open_issues: openIssues,
      quality_score: null,
    };
  }));

  return rows;
}
