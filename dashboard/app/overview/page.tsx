import Sidebar from '@/components/Sidebar';
import StatsCard from '@/components/StatsCard';
import SessionAlert from '@/components/SessionAlert';
import { query } from '@/lib/db';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

async function getOverview() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [groups, msgs, aiQueries, chunks, settings, chart, topQ, recentQ] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT group_id) AS count FROM messages WHERE msg_ts >= $1`, [todayStart]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages WHERE msg_ts >= $1`, [todayStart]
    ),
    query<{ count: string; avg_latency: string }>(
      `SELECT COUNT(*) AS count, AVG(latency_ms)::int AS avg_latency FROM ai_logs WHERE created_at >= $1`, [todayStart]
    ),
    query<{ count: string; last_indexed: string }>(
      `SELECT COUNT(*) AS count, MAX(indexed_at) AS last_indexed FROM doc_chunks`
    ),
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('session_status', 'session_last_seen', 'agent_name')`
    ),
    query<{ day: string; count: string }>(
      `SELECT DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day, COUNT(*) AS count
       FROM ai_logs
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day ORDER BY day`
    ),
    query<{ question: string; count: string }>(
      `SELECT query AS question, COUNT(*) AS count
       FROM ai_logs GROUP BY query ORDER BY count DESC LIMIT 5`
    ),
    query<{ query: string; answer: string; latency_ms: number; created_at: string }>(
      `SELECT query, answer, latency_ms, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 5`
    ),
  ]);

  const s = Object.fromEntries(settings.map(r => [r.key, r.value]));

  // Build 7-day chart: fill missing days with 0
  const chartMap = Object.fromEntries(chart.map(r => [r.day, Number(r.count)]));
  const days7: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days7.push({ label: d.toLocaleDateString('vi-VN', { weekday: 'short' }), count: chartMap[key] ?? 0 });
  }

  return {
    totalGroupsToday: Number(groups[0]?.count ?? 0),
    messagesToday:    Number(msgs[0]?.count ?? 0),
    aiQueriesToday:   Number(aiQueries[0]?.count ?? 0),
    avgLatencyMs:     Number(aiQueries[0]?.avg_latency ?? 0),
    docChunks:        Number(chunks[0]?.count ?? 0),
    lastIndexedAt:    chunks[0]?.last_indexed ?? null,
    sessionStatus:    s['session_status'] ?? 'unknown',
    sessionLastSeen:  s['session_last_seen'] ?? null,
    agentName:        s['agent_name'] ?? 'GiftZone AI',
    days7,
    topQuestions: topQ,
    recentQueries: recentQ,
  };
}

export default async function OverviewPage() {
  let data;
  try {
    data = await getOverview();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">Không kết nối được database.</p>
            <p className="text-sm mt-2 font-mono break-all">{msg}</p>
          </div>
        </main>
      </div>
    );
  }

  const chartMax = Math.max(...data.days7.map(d => d.count), 1);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
            <p className="text-sm text-gray-500 mt-0.5">Agent: {data.agentName}</p>
          </div>

          <SessionAlert status={data.sessionStatus} />

          {/* KPI cards */}
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

          {/* Row 2: chart + health */}
          <div className="grid grid-cols-3 gap-4">
            {/* 7-day chart */}
            <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">Hội thoại AI — 7 ngày qua</p>
              <div className="flex items-end gap-2 h-28">
                {data.days7.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400">{d.count || ''}</span>
                    <div className="w-full flex items-end" style={{ height: 72 }}>
                      <div
                        className="w-full rounded-t bg-blue-400"
                        style={{ height: `${d.count === 0 ? 2 : Math.max(8, (d.count / chartMax) * 72)}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">Trạng thái hệ thống</p>
              <ul className="space-y-3">
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Zalo session</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    data.sessionStatus === 'ok'
                      ? 'bg-green-50 text-green-700'
                      : data.sessionStatus === 'warning'
                      ? 'bg-yellow-50 text-yellow-700'
                      : data.sessionStatus === 'expired'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {data.sessionStatus === 'ok' ? '● Online'
                      : data.sessionStatus === 'warning' ? '● Warning'
                      : data.sessionStatus === 'expired' ? '● Expired'
                      : '○ Unknown'}
                  </span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Last seen</span>
                  <span className="text-xs text-gray-600">{timeAgo(data.sessionLastSeen)}</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Database</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">● Supabase OK</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Chunks</span>
                  <span className="text-xs text-gray-600">{data.docChunks} chunks</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Index gần nhất</span>
                  <span className="text-xs text-gray-600">{timeAgo(data.lastIndexedAt)}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Row 3: top questions + recent */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top questions */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">Top câu hỏi hay gặp</p>
              {data.topQuestions.length === 0
                ? <p className="text-xs text-gray-400">Chưa có dữ liệu.</p>
                : (
                  <ul className="space-y-3">
                    {data.topQuestions.map((q, i) => {
                      const max = Number(data.topQuestions[0]?.count ?? 1);
                      return (
                        <li key={i} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <p className="text-xs text-gray-700 flex-1 leading-snug">{q.question}</p>
                            <span className="text-xs font-medium text-blue-600 shrink-0">{q.count}</span>
                          </div>
                          <div className="h-1 bg-gray-100 rounded-full">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(Number(q.count) / max) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>

            {/* Recent queries */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">Câu hỏi gần nhất</p>
              {data.recentQueries.length === 0
                ? <p className="text-xs text-gray-400">Chưa có dữ liệu.</p>
                : (
                  <ul className="divide-y divide-gray-100">
                    {data.recentQueries.map((r, i) => (
                      <li key={i} className="py-2 flex gap-3 items-start">
                        <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                          {new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <p className="text-xs text-gray-700 flex-1 leading-snug">{r.query}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{(r.latency_ms / 1000).toFixed(1)}s</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
