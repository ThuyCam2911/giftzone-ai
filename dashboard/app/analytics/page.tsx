export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import AnalyticsPage from '@/components/AnalyticsPage';
import { getAnalyticsData } from '@/lib/queries/analytics';

export default async function Page() {
  let data;
  try {
    data = await getAnalyticsData();
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
