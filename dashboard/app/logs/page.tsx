import Sidebar from '@/components/Sidebar';
import { query } from '@/lib/db';

interface LogRow {
  id: number;
  group_id: string;
  query: string;
  answer: string;
  sources: string[];
  latency_ms: number;
  created_at: string;
}

async function getLogs(page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    query<LogRow>(
      `SELECT id, group_id, sender_uid, query, answer, sources, latency_ms, created_at
       FROM ai_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM ai_logs`),
  ]);
  const totalCount = Number(total[0]?.count ?? 0);
  return { rows, total: totalCount, totalPages: Math.ceil(totalCount / limit) };
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total, totalPages } = await getLogs(page);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">AI Logs</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} tổng số câu hỏi</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Group</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Câu hỏi</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nguồn</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">Chưa có dữ liệu</td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.group_id.slice(-6)}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{row.query}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {Array.isArray(row.sources) ? row.sources.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {row.latency_ms ? `${(row.latency_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-end">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <a
                  key={p}
                  href={`?page=${p}`}
                  className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
