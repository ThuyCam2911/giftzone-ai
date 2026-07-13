import { query } from '@/lib/db';
import { ensureZEnterpriseTable, type ZEnterpriseAccount } from './zenterprise';

export interface ZDashOverview {
  conversations: number;
  messages: number;
  aiQueries: number;
  openIssues: number;
  daysChart: { label: string; count: number }[];
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

  const [conv, msgs, aiQ, issues, chart] = await Promise.all([
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
    daysChart,
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
