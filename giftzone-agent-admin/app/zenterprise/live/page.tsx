export const dynamic = 'force-dynamic';

import MasterLayerShell, { Pill } from '@/components/MasterLayerShell';
import ZEnterpriseLive from '@/components/ZEnterpriseLive';
import { listInboxThreads } from '@/lib/queries/zenterprise-inbox';
import { getDict } from '@/lib/i18n/server';

export default async function ZEnterpriseLivePage() {
  const { t } = await getDict();

  let threads;
  try {
    threads = await listInboxThreads();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('ze.live.title')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  return (
    <MasterLayerShell
      title={t('ze.live.title')}
      subtitle={t('ze.live.subtitle')}
      pills={<Pill tone="live">● Live</Pill>}
    >
      <ZEnterpriseLive initialRealThreads={threads} />
    </MasterLayerShell>
  );
}
