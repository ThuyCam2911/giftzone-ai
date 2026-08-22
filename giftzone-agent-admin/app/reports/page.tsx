export const dynamic = 'force-dynamic';

import MasterLayerShell, { Pill } from '@/components/MasterLayerShell';
import { ReportCard } from '@/components/masterlayer/ui';
import { getBlocks } from '@/lib/queries/master-layer';
import { getDict } from '@/lib/i18n/server';

export default async function ReportsPage() {
  const { t } = await getDict();

  let reports;
  try {
    reports = (await getBlocks('report', 'report_card')).map(b => b.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('sidebar.reports')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  return (
    <MasterLayerShell
      title={t('sidebar.reports')}
      subtitle="AI đọc SuperFlow, AgriDMS, Loyalty và CRM, dựng báo cáo theo mẫu rồi diễn giải. File do team tự làm nằm cạnh nhưng không bị trộn lẫn."
      pills={<>
        <Pill tone="outline">Xuất theo guideline</Pill>
        <Pill tone="accent">Tạo báo cáo</Pill>
      </>}
    >
      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Chưa có báo cáo demo — gọi <code className="font-mono">POST /api/dev/seed-master-layer</code> để seed trước.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r, i) => <ReportCard key={i} data={r} />)}
        </div>
      )}
    </MasterLayerShell>
  );
}
