import { query } from '@/lib/db';

export interface SalesMemberRow {
  sender_uid: string;
  sender_name: string;
  role: string;
  msg_count: number;
  group_count: number;
  open_issues: number;
  avg_response_min: number | null;
}

export async function getSalesMembersData(): Promise<SalesMemberRow[]> {
  const rows = await query<{
    sender_uid: string;
    sender_name: string;
    role: string;
    msg_count: string;
    group_count: string;
    open_issues: string;
    avg_response_min: string | null;
  }>(
    `SELECT
       gz.sender_uid,
       gz.sender_name,
       gz.role,
       COUNT(DISTINCT m.id)::int             AS msg_count,
       COUNT(DISTINCT m.group_id)::int        AS group_count,
       COUNT(DISTINCT si.id)::int             AS open_issues,
       AVG(
         CASE WHEN prev_kh.msg_ts IS NOT NULL
           THEN EXTRACT(EPOCH FROM (m.msg_ts - prev_kh.msg_ts)) / 60
           ELSE NULL
         END
       )::int AS avg_response_min
     FROM gz_members gz
     LEFT JOIN messages m ON m.sender_uid = gz.sender_uid
       AND m.is_gz_member = true
       AND m.msg_ts >= NOW() - INTERVAL '30 days'
     LEFT JOIN LATERAL (
       SELECT MAX(msg2.msg_ts) AS msg_ts
       FROM messages msg2
       WHERE msg2.group_id = m.group_id
         AND msg2.msg_ts < m.msg_ts
         AND msg2.is_gz_member = false
         AND msg2.msg_type = 'text'
     ) prev_kh ON true
     LEFT JOIN sales_issues si ON si.group_id = m.group_id
       AND si.status = 'open'
       AND si.detected_at >= NOW() - INTERVAL '30 days'
     GROUP BY gz.sender_uid, gz.sender_name, gz.role
     ORDER BY msg_count DESC`,
  );

  return rows.map(r => ({
    sender_uid:       r.sender_uid,
    sender_name:      r.sender_name,
    role:             r.role,
    msg_count:        Number(r.msg_count),
    group_count:      Number(r.group_count),
    open_issues:      Number(r.open_issues),
    avg_response_min: r.avg_response_min !== null ? Number(r.avg_response_min) : null,
  }));
}
