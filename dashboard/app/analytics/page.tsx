export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import AnalyticsPage from '@/components/AnalyticsPage';
import { query } from '@/lib/db';

async function getData() {
  const [topQuestions, groupUsage, docUsage, latencyRows, chartRows, unanswered] = await Promise.all([
    query<{ question: string; cnt: string }>(
      `SELECT query AS question, COUNT(*) AS cnt
       FROM ai_logs GROUP BY query ORDER BY cnt DESC LIMIT 10`
    ),
    query<{ group_id: string; group_name: string | null; cnt: string; avg_ms: string }>(
      `SELECT l.group_id, gn.name AS group_name, COUNT(*) AS cnt, AVG(l.latency_ms)::int AS avg_ms
       FROM ai_logs l
       LEFT JOIN group_names gn ON gn.group_id = l.group_id
       GROUP BY l.group_id, gn.name ORDER BY cnt DESC LIMIT 10`
    ),
    query<{ src: string; cnt: string }>(
      `SELECT src, COUNT(*) AS cnt
       FROM ai_logs, jsonb_array_elements_text(sources) AS src
       WHERE sources IS NOT NULL AND jsonb_array_length(sources) > 0
       GROUP BY src ORDER BY cnt DESC LIMIT 10`
    ),
    query<{ p50: string; p95: string; max_ms: string; total: string }>(
      `SELECT
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::int AS p50,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
         MAX(latency_ms) AS max_ms,
         COUNT(*) AS total
       FROM ai_logs WHERE created_at >= NOW() - INTERVAL '7 days'`
    ),
    query<{ day: string; count: string }>(
      `SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
              COUNT(*) AS count
       FROM ai_logs
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day ORDER BY day`
    ),
    query<{ question: string; cnt: string }>(
      `SELECT query AS question, COUNT(*) AS cnt
       FROM ai_logs WHERE answer ILIKE '%chưa có thông tin%'
       GROUP BY query ORDER BY cnt DESC LIMIT 10`
    ),
  ]);

  const latency = latencyRows[0];

  // Build 7-day chart with filled gaps
  const chartMap = Object.fromEntries(chartRows.map(r => [r.day, Number(r.count)]));
  const days7: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    days7.push({
      label: d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }),
      count: chartMap[key] ?? 0,
    });
  }

  return {
    topQuestions: topQuestions.map(r => ({ question: r.question, cnt: Number(r.cnt) })),
    groupUsage: groupUsage.map(r => ({ group_id: r.group_id, group_name: r.group_name ?? null, cnt: Number(r.cnt), avg_ms: Number(r.avg_ms) })),
    docUsage: docUsage.map(r => ({ src: r.src, cnt: Number(r.cnt) })),
    latency: latency
      ? { p50: Number(latency.p50), p95: Number(latency.p95), maxMs: Number(latency.max_ms), total: Number(latency.total) }
      : { p50: 0, p95: 0, maxMs: 0, total: 0 },
    days7,
    unanswered: unanswered.map(r => ({ question: r.question, cnt: Number(r.cnt) })),
  };
}

export default async function Page() {
  let data;
  try {
    data = await getData();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">Không kết nối được database.</p>
            <p className="text-sm mt-2 font-mono break-all">{msg}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Thống kê hiệu suất AI · 7 ngày gần nhất</p>
        </div>
        <div className="px-4 pb-8 md:px-8 pt-6">
          <div className="max-w-5xl mx-auto">
            <AnalyticsPage {...data} />
          </div>
        </div>
      </main>
    </div>
  );
}
