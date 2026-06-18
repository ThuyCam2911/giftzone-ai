import { query } from '@/lib/db';
import { toVNDateString } from '@/lib/utils';
import type { QuestionRow, GroupUsageRow, DocUsageRow, LatencyStats, DayCount } from '@/types';

export interface AnalyticsData {
  topQuestions: QuestionRow[];
  groupUsage: GroupUsageRow[];
  docUsage: DocUsageRow[];
  latency: LatencyStats;
  days7: DayCount[];
  unanswered: QuestionRow[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const [topQuestions, groupUsage, docUsage, latencyRows, chartRows, unanswered] = await Promise.all([
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
       FROM ai_logs WHERE answer ILIKE '%chưa có thông tin%'
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY query ORDER BY cnt DESC LIMIT 10`,
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
  };
}
