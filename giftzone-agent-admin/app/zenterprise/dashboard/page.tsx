export const dynamic = 'force-dynamic';

import MasterLayerShell from '@/components/MasterLayerShell';
import ZEnterpriseDashboard from '@/components/ZEnterpriseDashboard';
import { getZDashOverview, getZDashAccounts, getZDashChatbot, getZDashMonitor } from '@/lib/queries/zenterprise-dashboard';
import { defaultDateRange } from '@/lib/utils';
import { getDict } from '@/lib/i18n/server';

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

  let overview, accounts, chatbot, monitor;
  try {
    accounts = await getZDashAccounts(from, to);
    const selectedAccount = selectedAccountId ? accounts.find(a => a.id === selectedAccountId) ?? null : null;
    const groupIds = selectedAccount ? selectedAccount.group_ids : null;

    [overview, chatbot, monitor] = await Promise.all([
      getZDashOverview(from, to, groupIds),
      getZDashChatbot(from, to, groupIds),
      getZDashMonitor(from, to, groupIds),
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('ze.dash.title')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  return (
    <MasterLayerShell title={t('ze.dash.title')} subtitle={t('ze.dash.subtitle')}>
      <div className="max-w-5xl">
        <ZEnterpriseDashboard
          overview={overview}
          accounts={accounts}
          chatbot={chatbot}
          monitor={monitor}
          from={from}
          to={to}
          selectedAccountId={selectedAccountId}
        />
      </div>
    </MasterLayerShell>
  );
}
