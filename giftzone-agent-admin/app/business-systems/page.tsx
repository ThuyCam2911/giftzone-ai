export const dynamic = 'force-dynamic';

import MasterLayerShell from '@/components/MasterLayerShell';
import BusinessSystemsTabs from '@/components/BusinessSystemsTabs';
import { getBlocks, type BlockPage } from '@/lib/queries/master-layer';
import { getDict } from '@/lib/i18n/server';

const TAB_PAGES: { key: BlockPage; label: string }[] = [
  { key: 'agridms', label: 'AgriDMS' },
  { key: 'loyalty', label: 'Loyalty đại lý' },
  { key: 'crm', label: 'SaleZone CRM' },
];

export default async function BusinessSystemsPage() {
  const { t } = await getDict();

  let tabs;
  try {
    tabs = await Promise.all(TAB_PAGES.map(async ({ key, label }) => {
      const blocks = await getBlocks(key);
      return {
        key,
        label,
        kpis: blocks.filter(b => b.section === 'kpi').map(b => b.data),
        lists: blocks.filter(b => b.section === 'list').map(b => b.data),
        insight: blocks.find(b => b.section === 'insight')?.data,
      };
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('sidebar.businessSystems')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  const hasData = tabs.some(t => t.kpis.length > 0);

  return (
    <MasterLayerShell
      title={t('sidebar.businessSystems')}
      subtitle="Chỉ số chính từ DMS, Loyalty đại lý và CRM. Portal đọc và diễn giải; mọi thao tác ghi vẫn nằm ở hệ thống gốc."
    >
      {!hasData ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Chưa có dữ liệu demo — gọi <code className="font-mono">POST /api/dev/seed-master-layer</code> để seed trước.
        </div>
      ) : (
        <BusinessSystemsTabs tabs={tabs} />
      )}
    </MasterLayerShell>
  );
}
