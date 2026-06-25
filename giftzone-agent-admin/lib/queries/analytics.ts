import { query } from '@/lib/db';
import { toVNDateString } from '@/lib/utils';
import type { QuestionRow, GroupUsageRow, DocUsageRow, LatencyStats, DayCount } from '@/types';

export interface ResponseTimeRow {
  sender_uid: string;
  sender_name: string;
  role: string;
  msg_count: number;
  group_count: number;
  avg_response_min: number | null;
}

export interface AnalyticsData {
  topQuestions: QuestionRow[];
  groupUsage: GroupUsageRow[];
  docUsage: DocUsageRow[];
  latency: LatencyStats;
  days7: DayCount[];
  unanswered: QuestionRow[];
  unansweredTotal: number;
  responseTimes: ResponseTimeRow[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const [topQuestions, groupUsage, docUsage, latencyRows, chartRows, unanswered, unansweredCount, responseTimeRows] = await Promise.all([
    query<{ question: string; cnt: string }>(
      `SELECT query AS question, COUNT(*) AS cnt
       FROM ai_logs WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY query ORDER BY cnt DESC LIMIT 10`,
    ),
    query<{ group_id: string; group_name: string | null; cnt: string; avg_ms: string }>(
      `SELECT l.group_id, gn.name AS group_name, COUNT(*) AS cnt, AVG(l.latency_ms)::int AS avg_ms
       FROM ai_logs l
       LEFT JOIN group_names gn ON gn.group_id = l.group_id
       GROUP BY l.group_id, gn.name ORDER BY cnt DESC LIMIT 10`,
    ),
    query<{ src: string; cnt: string }>(
      `SELECT src, COUNT(*) AS cnt
       FROM ai_logs, jsonb_array_elements_text(sources) AS src
       WHERE sources IS NOT NULL AND jsonb_array_length(sources) > 0
       GROUP BY src ORDER BY cnt DESC LIMIT 10`,
    ),
    query<{ p50: string; p95: string; max_ms: string; total: string }>(
      `SELECT
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::int AS p50,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
         MAX(latency_ms) AS max_ms,
         COUNT(*) AS total
       FROM ai_logs WHERE created_at >= NOW() - INTERVAL '7 days'`,
    ),
    query<{ day: string; count: string }>(
      `SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
              COUNT(*) AS count
       FROM ai_logs
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day ORDER BY day`,
    ),
    query<{ question: string; cnt: string }>(
      `SELECT query AS question, COUNT(*) AS cnt
       FROM ai_logs
       WHERE (is_answered = false OR answer ILIKE '%chưa có thông tin%')
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY query ORDER BY cnt DESC LIMIT 10`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ai_logs
       WHERE (is_answered = false OR answer ILIKE '%chưa có thông tin%')
         AND created_at >= NOW() - INTERVAL '7 days'`,
    ),
    // Response time per GZ member — chỉ có data sau khi is_gz_member được set
    query<{ sender_uid: string; sender_name: string; role: string; msg_count: string; group_count: string; avg_response_min: string | null }>(
      `SELECT
         gz.sender_uid,
         gz.sender_name,
         gz.role,
         COUNT(m.id)::int AS msg_count,
         COUNT(DISTINCT m.group_id)::int AS group_count,
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
       GROUP BY gz.sender_uid, gz.sender_name, gz.role
       ORDER BY msg_count DESC`,
    ),
  ]);

  const raw = latencyRows[0];
  const latency: LatencyStats = raw
    ? { p50: Number(raw.p50), p95: Number(raw.p95), maxMs: Number(raw.max_ms), total: Number(raw.total) }
    : { p50: 0, p95: 0, maxMs: 0, total: 0 };

  const chartMap = Object.fromEntries(chartRows.map(r => [r.day, Number(r.count)]));
  const days7: DayCount[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toVNDateString(d);
    days7.push({
      label: d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }),
      count: chartMap[key] ?? 0,
    });
  }

  return {
    unansweredTotal: Number(unansweredCount[0]?.count ?? 0),
    topQuestions: topQuestions.map(r => ({ question: r.question, cnt: Number(r.cnt) })),
    groupUsage:   groupUsage.map(r => ({
      group_id:   r.group_id,
      group_name: r.group_name ?? null,
      cnt:        Number(r.cnt),
      avg_ms:     Number(r.avg_ms),
    })),
    docUsage:     docUsage.map(r => ({ src: r.src, cnt: Number(r.cnt) })),
    latency,
    days7,
    unanswered:   unanswered.map(r => ({ question: r.question, cnt: Number(r.cnt) })),
    responseTimes: responseTimeRows.map(r => ({
      sender_uid:       r.sender_uid,
      sender_name:      r.sender_name,
      role:             r.role,
      msg_count:        Number(r.msg_count),
      group_count:      Number(r.group_count),
      avg_response_min: r.avg_response_min !== null ? Number(r.avg_response_min) : null,
    })),
  };
}
