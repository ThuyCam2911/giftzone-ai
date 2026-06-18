import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [groups, msgs, aiQueries, chunks, settings] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT group_id) AS count FROM messages WHERE msg_ts >= $1`,
      [todayStart]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages WHERE msg_ts >= $1`,
      [todayStart]
    ),
    query<{ count: string; avg_latency: string }>(
      `SELECT COUNT(*) AS count, AVG(latency_ms)::int AS avg_latency FROM ai_logs WHERE created_at >= $1`,
      [todayStart]
    ),
    query<{ count: string; last_indexed: string }>(
      `SELECT COUNT(*) AS count, MAX(indexed_at) AS last_indexed FROM doc_chunks`
    ),
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('session_status', 'session_last_seen', 'agent_name')`
    ),
  ]);

  const settingsMap = Object.fromEntries(settings.map(r => [r.key, r.value]));

  return NextResponse.json({
    totalGroupsToday:  Number(groups[0]?.count ?? 0),
    messagesToday:     Number(msgs[0]?.count ?? 0),
    aiQueriesToday:    Number(aiQueries[0]?.count ?? 0),
    avgLatencyMs:      Number(aiQueries[0]?.avg_latency ?? 0),
    docChunks:         Number(chunks[0]?.count ?? 0),
    lastIndexedAt:     chunks[0]?.last_indexed ?? null,
    sessionStatus:     settingsMap['session_status'] ?? 'unknown',
    sessionLastSeen:   settingsMap['session_last_seen'] ?? null,
    agentName:         settingsMap['agent_name'] ?? 'GiftZone AI',
  });
}
