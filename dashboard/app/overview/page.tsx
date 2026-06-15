import Sidebar from '@/components/Sidebar';
import StatsCard from '@/components/StatsCard';
import SessionAlert from '@/components/SessionAlert';
import { query } from '@/lib/db';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function getOverview() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [groups, msgs, aiQueries, chunks, settings] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(DISTINCT group_id) AS count FROM messages WHERE msg_ts >= $1`, [todayStart]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM messages WHERE msg_ts >= $1`, [todayStart]),
    query<{ count: string; avg_latency: string }>(`SELECT COUNT(*) AS count, AVG(latency_ms)::int AS avg_latency FROM ai_logs WHERE created_at >= $1`, [todayStart]),
    query<{ count: string; last_indexed: string }>(`SELECT COUNT(*) AS count, MAX(indexed_at) AS last_indexed FROM doc_chunks`),
    query<{ key: string; value: string }>(`SELECT key, value FROM settings WHERE key IN ('session_status', 'session_last_seen', 'agent_name')`),
  ]);

  const s = Object.fromEntries(settings.map(r => [r.key, r.value]));
  return {
    totalGroupsToday: Number(groups[0]?.count ?? 0),
    messagesToday:    Number(msgs[0]?.count ?? 0),
    aiQueriesToday:   Number(aiQueries[0]?.count ?? 0),
    avgLatencyMs:     Number(aiQueries[0]?.avg_latency ?? 0),
    docChunks:        Number(chunks[0]?.count ?? 0),
    lastIndexedAt:    chunks[0]?.last_indexed ?? null,
    sessionStatus:    s['session_status'] ?? 'unknown',
    agentName:        s['agent_name'] ?? 'GiftZone AI',
  };
}

export default async function OverviewPage() {
  let data;
  try {
    data = await getOverview();
  } catch {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">Không kết nối được database.</p>
            <p className="text-sm mt-1">Kiểm tra Docker container <code className="bg-red-100 px-1 rounded">giftzone-pg</code> đang chạy trên port 5433.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
            <p className="text-sm text-gray-500 mt-0.5">Agent: {data.agentName}</p>
          </div>

          <SessionAlert status={data.sessionStatus} />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Groups hoạt động hôm nay" value={data.totalGroupsToday} />
            <StatsCard label="Tin nhắn hôm nay" value={data.messagesToday} />
            <StatsCard
              label="Câu hỏi AI hôm nay"
              value={data.aiQueriesToday}
              sub={data.avgLatencyMs ? `Avg ${(data.avgLatencyMs / 1000).toFixed(1)}s` : undefined}
            />
            <StatsCard
              label="Chunks đã index"
              value={data.docChunks}
              sub={data.lastIndexedAt ? `Cập nhật: ${formatDate(data.lastIndexedAt)}` : undefined}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
