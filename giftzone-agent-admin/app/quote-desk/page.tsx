export const dynamic = 'force-dynamic';

import MasterLayerShell, { Pill } from '@/components/MasterLayerShell';
import QuoteDesk from '@/components/QuoteDesk';
import AgriMetricsStrip from '@/components/AgriMetricsStrip';
import { listActiveQuotes, getAgriDemoMetrics } from '@/lib/queries/quote-negotiations';
import { getDict } from '@/lib/i18n/server';
import { Sparkles } from 'lucide-react';

export default async function QuoteDeskPage() {
  const { t, locale } = await getDict();

  let quotes;
  let metrics;
  try {
    [quotes, metrics] = await Promise.all([listActiveQuotes(), getAgriDemoMetrics()]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <MasterLayerShell title={t('sidebar.quoteDesk')}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          <p className="font-medium">{t('common.dbError')}</p>
          <p className="text-sm mt-2 font-mono break-all">{msg}</p>
        </div>
      </MasterLayerShell>
    );
  }

  const subtitle = locale === 'en'
    ? 'AI escalates customer quote requests here — Sales negotiates with the AI, then approves to send back over Zalo.'
    : 'AI đưa các yêu cầu báo giá của khách lên đây — Sales trao đổi điều chỉnh với AI rồi duyệt để gửi lại khách qua Zalo.';

  return (
    <MasterLayerShell
      title={t('sidebar.quoteDesk')}
      subtitle={subtitle}
      pills={<>
        <Pill tone="live">● Live</Pill>
        <Pill tone="warn">{locale === 'en' ? 'Awaiting Sales' : 'Chờ Sales duyệt'}</Pill>
        <Pill tone="accent"><Sparkles size={12} /> Quote Desk</Pill>
      </>}
    >
      <AgriMetricsStrip metrics={metrics} locale={locale} />
      <QuoteDesk initialQuotes={quotes} />
    </MasterLayerShell>
  );
}
