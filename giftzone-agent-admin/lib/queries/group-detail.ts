import { query } from '@/lib/db';
import type { SalesIssue } from '@/types';

export interface GroupDetailData {
  group: { group_id: string; name: string; group_type: string } | null;
  msgStats: { total: number; last7Days: number; lastMsgAt: string | null };
  aiLogs: { id: number; query: string; answer: string; latency_ms: number; created_at: string }[];
  openIssues: SalesIssue[];
  topSenders: { sender_name: string; msg_count: number }[];
}

export async function getGroupDetail(groupId: string): Promise<GroupDetailData> {
  const [groupRow, msgStats, aiLogs, openIssues, topSenders] = await Promise.all([
    query<{ group_id: string; name: string; group_type: string }>(
      `SELECT group_id, name, group_type FROM group_names WHERE group_id = $1`,
      [groupId],
    ),
    query<{ total: string; last7: string; last_msg_at: string | null }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN msg_ts >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS last7,
         MAX(msg_ts) AS last_msg_at
       FROM messages WHERE group_id = $1`,
      [groupId],
    ),
    query<{ id: number; query: string; answer: string; latency_ms: number; created_at: string }>(
      `SELECT id, query, answer, latency_ms, created_at
       FROM ai_logs WHERE group_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [groupId],
    ),
    query<SalesIssue>(
      `SELECT id, group_id, $2 AS group_name, issue_key, issue_type, severity,
              title, description, evidence, status, detected_at, resolved_at
       FROM sales_issues
       WHERE group_id = $1 AND status = 'open'
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      [groupId, null],
    ),
    query<{ sender_name: string; msg_count: number }>(
      `SELECT sender_name, COUNT(*) AS msg_count
       FROM messages WHERE group_id = $1 AND sender_name IS NOT NULL
       GROUP BY sender_name ORDER BY msg_count DESC LIMIT 10`,
      [groupId],
    ),
  ]);

  const s = msgStats[0];
  return {
    group: groupRow[0] ?? null,
    msgStats: {
      total: Number(s?.total ?? 0),
      last7Days: Number(s?.last7 ?? 0),
      lastMsgAt: s?.last_msg_at ?? null,
    },
    aiLogs,
    openIssues: openIssues.map(i => ({ ...i, group_name: groupRow[0]?.name ?? null })),
    topSenders: topSenders.map(r => ({ sender_name: r.sender_name, msg_count: Number(r.msg_count) })),
  };
}

export interface InactiveGroup {
  group_id: string;
  name: string | null;
  last_msg_at: string | null;
  days_silent: number;
}

export async function getInactiveGroups(thresholdDays = 3): Promise<InactiveGroup[]> {
  const rows = await query<{ group_id: string; name: string | null; last_msg_at: string | null }>(
    `SELECT m.group_id, gn.name,
            MAX(m.msg_ts) AS last_msg_at
     FROM messages m
     LEFT JOIN group_names gn ON gn.group_id = m.group_id
     WHERE COALESCE(gn.group_type, 'customer') != 'internal'
     GROUP BY m.group_id, gn.name
     HAVING MAX(m.msg_ts) < NOW() - ($1 || ' days')::INTERVAL
     ORDER BY MAX(m.msg_ts) ASC`,
    [thresholdDays],
  );
  const now = Date.now();
  return rows.map(r => ({
    group_id: r.group_id,
    name: r.name,
    last_msg_at: r.last_msg_at,
    days_silent: r.last_msg_at
      ? Math.floor((now - new Date(r.last_msg_at).getTime()) / 86400000)
      : 999,
  }));
}
