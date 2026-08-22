export const dynamic = 'force-dynamic';

import MasterLayerShell from '@/components/MasterLayerShell';
import AnalyticsPage from '@/components/AnalyticsPage';
import { getAnalyticsData } from '@/lib/queries/analytics';
import { getDict } from '@/lib/i18n/server';

export default async function Page() {
  const { t } = await getDict();
  let data;
  try {
    data = await getAnalyticsData();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('analytics.title')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  return (
    <MasterLayerShell title={t('analytics.title')} subtitle={t('analytics.subtitle')}>
      <div className="max-w-5xl mx-auto">
        <AnalyticsPage {...data} />
      </div>
    </MasterLayerShell>
  );
}
