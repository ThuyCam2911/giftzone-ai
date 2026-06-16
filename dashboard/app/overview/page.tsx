export const dynamic = 'force-dynamic';

import { unstable_cache } from 'next/cache';
import Sidebar from '@/components/Sidebar';
import StatsCard from '@/components/StatsCard';
import SessionAlert from '@/components/SessionAlert';
import WeekChart from '@/components/WeekChart';
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

const getCachedOverview = unstable_cache(
  async (todayISO: string) => _getOverview(todayISO),
  ['overview'],
  { revalidate: 60, tags: ['overview'] } // cache 60 giây
);

async function getOverview() {
  // Key theo ngày VN để cache tự reset sau nửa đêm
  const todayISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  return getCachedOverview(todayISO);
}

async function _getOverview(todayISO: string) {
  const todayStart = new Date(`${todayISO}T00:00:00+07:00`); // midnight Vietnam time

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
  const chartMap = Object.fromEntries(chart.map(r => [
    new Date(r.day).toISOString().slice(0, 10),
    Number(r.count),
  ]));
  const days7: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }); // sv-SE cho định dạng YYYY-MM-DD
    days7.push({ label: d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }), count: chartMap[key] ?? 0 });
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Tổng quan</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>Agent: <span style={{ color: '#02AD64', fontWeight: 600 }}>{data.agentName}</span></p>
          </div>

          <SessionAlert status={data.sessionStatus} />

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Groups hoạt động hôm nay" value={data.totalGroupsToday} icon="👥" accent="green" />
            <StatsCard label="Tin nhắn hôm nay" value={data.messagesToday} icon="💬" accent="blue" />
            <StatsCard
              label="Câu hỏi AI hôm nay"
              value={data.aiQueriesToday}
              sub={data.avgLatencyMs ? `Avg ${(data.avgLatencyMs / 1000).toFixed(1)}s` : undefined}
              icon="🤖" accent="orange"
            />
            <StatsCard
              label="Chunks đã index"
              value={data.docChunks}
              sub={data.lastIndexedAt ? `Cập nhật: ${formatDate(data.lastIndexedAt)}` : undefined}
              icon="📄" accent="purple"
            />
          </div>

          {/* Row 2: chart + health */}
          <div className="grid grid-cols-3 gap-4">
            {/* 7-day chart */}
            <div className="col-span-2">
              <WeekChart days={data.days7} />
            </div>

            {/* Health */}
            <div className="bg-white rounded-2xl p-5"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Trạng thái hệ thống</p>
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: '#6b7280' }}>Zalo session</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={
                    data.sessionStatus === 'ok'
                      ? { background: '#e6f9f1', color: '#018a4e' }
                      : data.sessionStatus === 'warning'
                      ? { background: '#fffbeb', color: '#92400e' }
                      : data.sessionStatus === 'expired'
                      ? { background: '#fef2f2', color: '#991b1b' }
                      : { background: '#f3f4f6', color: '#6b7280' }
                  }>
                    <span className={data.sessionStatus === 'ok' ? 'pulse-green' : ''}>●</span>
                    {data.sessionStatus === 'ok' ? 'Online'
                      : data.sessionStatus === 'warning' ? 'Warning'
                      : data.sessionStatus === 'expired' ? 'Expired'
                      : 'Unknown'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: '#6b7280' }}>Last seen</span>
                  <span className="text-xs font-medium" style={{ color: '#374151' }}>{timeAgo(data.sessionLastSeen)}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: '#6b7280' }}>Database</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: '#e6f9f1', color: '#018a4e' }}>
                    <span className="pulse-green">●</span> Supabase OK
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: '#6b7280' }}>Tài liệu index</span>
                  <span className="text-xs font-medium" style={{ color: '#374151' }}>{data.docChunks} chunks</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: '#6b7280' }}>Index gần nhất</span>
                  <span className="text-xs font-medium" style={{ color: '#374151' }}>{timeAgo(data.lastIndexedAt)}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Row 3: top questions + recent */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top questions */}
            <div className="bg-white rounded-2xl p-5"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Top câu hỏi hay gặp</p>
              <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>Dựa trên lịch sử AI Logs</p>
              {data.topQuestions.length === 0
                ? <p className="text-xs" style={{ color: '#9ca3af' }}>Chưa có dữ liệu.</p>
                : (
                  <ul className="space-y-3">
                    {data.topQuestions.map((q, i) => {
                      const max = Number(data.topQuestions[0]?.count ?? 1);
                      return (
                        <li key={i} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <p className="text-xs flex-1 leading-snug" style={{ color: '#374151' }}>{q.question}</p>
                            <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                              style={{ background: '#fff3eb', color: '#FF6900' }}>{q.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: '#f3f4f6' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(Number(q.count) / max) * 100}%`, background: '#02AD64' }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>

            {/* Recent queries */}
            <div className="bg-white rounded-2xl p-5"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Câu hỏi gần nhất</p>
              <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>5 câu hỏi mới nhất từ Sales</p>
              {data.recentQueries.length === 0
                ? <p className="text-xs" style={{ color: '#9ca3af' }}>Chưa có dữ liệu.</p>
                : (
                  <ul className="space-y-0">
                    {data.recentQueries.map((r, i) => (
                      <li key={i} className="py-2.5 flex gap-3 items-start"
                        style={{ borderBottom: i < data.recentQueries.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span className="text-[10px] shrink-0 mt-0.5 font-medium"
                          style={{ color: '#02AD64' }}>
                          {new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                        </span>
                        <p className="text-xs flex-1 leading-snug" style={{ color: '#374151' }}>{r.query}</p>
                        <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded font-medium"
                          style={{ background: '#f3f4f6', color: '#6b7280' }}>
                          {(r.latency_ms / 1000).toFixed(1)}s
                        </span>
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
