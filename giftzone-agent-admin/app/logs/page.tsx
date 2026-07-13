export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import { getLogs } from '@/lib/queries/logs';
import { getDict } from '@/lib/i18n/server';

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, locale } = await getDict();
  const params = await searchParams;
  const page   = Number(params.page ?? 1);
  const { rows, total, totalPages } = await getLogs(page);
  const dateLocale = locale === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">{t('logs.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{total} {t('logs.totalQuestions')}</p>
        </div>

        <div className="px-4 pb-8 md:px-8 pt-6">
          <div className="max-w-5xl">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('logs.time')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('logs.group')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('logs.question')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('logs.source')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('logs.latency')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-400">{t('logs.noData')}</td>
                    </tr>
                  )}
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(row.created_at).toLocaleString(dateLocale, { timeZone: 'Asia/Ho_Chi_Minh' })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.group_name
                          ? <span className="text-gray-800 font-medium">{row.group_name}</span>
                          : <span className="text-gray-400 italic">{t('logs.directChat')}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{row.query}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {Array.isArray(row.sources) ? row.sources.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {row.latency_ms ? `${(row.latency_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex gap-2 mt-4 justify-end flex-wrap">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <a key={p} href={`?page=${p}`}
                    className={`px-3 py-1 rounded text-sm ${p === page
                      ? 'text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={p === page ? { background: '#02AD64' } : {}}>
                    {p}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
