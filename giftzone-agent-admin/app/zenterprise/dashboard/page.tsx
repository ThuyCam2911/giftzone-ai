export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import ZEnterpriseDashboard from '@/components/ZEnterpriseDashboard';
import { getZDashOverview, getZDashAccounts } from '@/lib/queries/zenterprise-dashboard';
import { defaultDateRange } from '@/lib/utils';
import { getDict } from '@/lib/i18n/server';
import { PieChart } from 'lucide-react';

export default async function ZEnterpriseDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; account?: string }>;
}) {
  const { t } = await getDict();
  const params   = await searchParams;
  const defaults = defaultDateRange(6);
  const from = params.from ?? defaults.from;
  const to   = params.to   ?? defaults.to;
  const selectedAccountId = params.account ? Number(params.account) : null;

  let overview, accounts;
  try {
    [overview, accounts] = await Promise.all([
      getZDashOverview(from, to),
      getZDashAccounts(from, to),
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">{t('common.dbError')}</p>
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
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-6 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <PieChart size={18} className="text-[#02AD64]" />
            {t('ze.dash.title')}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('ze.dash.subtitle')}</p>
        </div>
        <div className="px-4 pb-10 md:px-8 pt-6 max-w-5xl">
          <ZEnterpriseDashboard
            overview={overview}
            accounts={accounts}
            from={from}
            to={to}
            selectedAccountId={selectedAccountId}
          />
        </div>
      </main>
    </div>
  );
}
