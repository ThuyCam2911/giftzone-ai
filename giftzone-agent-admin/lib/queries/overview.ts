import { query } from '@/lib/db';
import { toVNDateString } from '@/lib/utils';
import type { DayCount } from '@/types';

export interface OverviewData {
  totalGroups: number;
  messages: number;
  aiQueries: number;
  avgLatencyMs: number;
  docChunks: number;
  lastIndexedAt: string | null;
  sessionStatus: string;
  sessionLastSeen: string | null;
  analyzerStatus: string;
  agentName: string;
  daysChart: DayCount[];
  topQuestions: { question: string; count: string }[];
  recentQueries: { query: string; answer: string; latency_ms: number; created_at: string }[];
}

export async function getOverviewData(from: string, to: string): Promise<OverviewData> {
  const fromTs = new Date(`${from}T00:00:00+07:00`);
  const toTs   = new Date(`${to}T23:59:59+07:00`);

  const [groups, msgs, aiQueries, chunks, settings, chart, topQ, recentQ] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT group_id) AS count FROM messages WHERE msg_ts >= $1 AND msg_ts <= $2`,
      [fromTs, toTs],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages WHERE msg_ts >= $1 AND msg_ts <= $2`,
      [fromTs, toTs],
    ),
    query<{ count: string; avg_latency: string }>(
      `SELECT COUNT(*) AS count, AVG(latency_ms)::int AS avg_latency
       FROM ai_logs WHERE created_at >= $1 AND created_at <= $2`,
      [fromTs, toTs],
    ),
    query<{ count: string; last_indexed: string }>(
      `SELECT COUNT(*) AS count, MAX(indexed_at) AS last_indexed FROM doc_chunks`,
    ),
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('session_status', 'session_last_seen', 'agent_name', 'analyzer_status')`,
    ),
    query<{ day: string; count: string }>(
      `SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM ai_logs WHERE created_at >= $1 AND created_at <= $2
       GROUP BY day ORDER BY day`,
      [fromTs, toTs],
    ),
    query<{ question: string; count: string }>(
      `SELECT query AS question, COUNT(*) AS count
       FROM ai_logs WHERE created_at >= $1 AND created_at <= $2
       GROUP BY query ORDER BY count DESC LIMIT 5`,
      [fromTs, toTs],
    ),
    query<{ query: string; answer: string; latency_ms: number; created_at: string }>(
      `SELECT query, answer, latency_ms, created_at
       FROM ai_logs WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at DESC LIMIT 5`,
      [fromTs, toTs],
    ),
  ]);

  const s = Object.fromEntries(settings.map(r => [r.key, r.value]));

  const chartMap = Object.fromEntries(chart.map(r => [r.day, Number(r.count)]));
  const daysChart: DayCount[] = [];
  const fromDate = new Date(`${from}T00:00:00+07:00`);
  const toDate   = new Date(`${to}T00:00:00+07:00`);
  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
  const maxDays  = Math.min(diffDays + 1, 30);
  const step     = Math.ceil((diffDays + 1) / maxDays);
  for (let i = 0; i <= diffDays; i += step) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const key = toVNDateString(d);
    daysChart.push({
      label: diffDays <= 7
        ? d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
        : d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }),
      count: chartMap[key] ?? 0,
    });
  }

  return {
    totalGroups:    Number(groups[0]?.count ?? 0),
    messages:       Number(msgs[0]?.count ?? 0),
    aiQueries:      Number(aiQueries[0]?.count ?? 0),
    avgLatencyMs:   Number(aiQueries[0]?.avg_latency ?? 0),
    docChunks:      Number(chunks[0]?.count ?? 0),
    lastIndexedAt:  chunks[0]?.last_indexed ?? null,
    sessionStatus:  s['session_status'] ?? 'unknown',
    sessionLastSeen: s['session_last_seen'] ?? null,
    analyzerStatus: s['analyzer_status'] ?? 'ok',
    agentName:      s['agent_name'] ?? 'GiftZone AI',
    daysChart,
    topQuestions:   topQ,
    recentQueries:  recentQ,
  };
}
