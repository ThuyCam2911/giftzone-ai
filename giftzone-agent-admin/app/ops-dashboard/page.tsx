export const dynamic = 'force-dynamic';

import MasterLayerShell, { Pill } from '@/components/MasterLayerShell';
import { KpiCard, AlertCard, BarChartCard, ActivityFeed, InsightBox } from '@/components/masterlayer/ui';
import { getBlocks } from '@/lib/queries/master-layer';
import { getDict } from '@/lib/i18n/server';

export default async function OpsDashboardPage() {
  const { t } = await getDict();

  let blocks;
  try {
    blocks = await getBlocks('dashboard');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('sidebar.opsDashboard')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  const kpis = blocks.filter(b => b.section === 'kpi').map(b => b.data);
  const alerts = blocks.filter(b => b.section === 'alert').map(b => b.data);
  const chart = blocks.find(b => b.section === 'chart')?.data;
  const activity = blocks.filter(b => b.section === 'activity').map(b => b.data);
  const insight = blocks.find(b => b.section === 'insight')?.data;

  if (kpis.length === 0) {
    return (
      <MasterLayerShell title={t('sidebar.opsDashboard')}>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Chưa có dữ liệu demo — gọi <code className="font-mono">POST /api/dev/seed-master-layer</code> để seed trước.
        </div>
      </MasterLayerShell>
    );
  }

  return (
    <MasterLayerShell
      title="Trung tâm điều hành"
      subtitle="Thứ Bảy 25/07/2026 · Vụ Hè Thu · 6 account zEnterprise đang phục vụ · SuperFlow đã chạy 38 ngày"
      pills={<Pill tone="warn">● Đang xem trực Đại lý / NPP</Pill>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {kpis.map((k, i) => <KpiCard key={i} data={k} />)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {alerts.map((a, i) => <AlertCard key={i} data={a} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {chart && <BarChartCard data={chart} />}
          {insight && <InsightBox data={insight} />}
        </div>
        <ActivityFeed title="Hoạt động gần đây" items={activity} />
      </div>
    </MasterLayerShell>
  );
}
