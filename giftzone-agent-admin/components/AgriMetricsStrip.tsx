import { Sprout, MessagesSquare, Target, Zap, ReceiptText, Wallet } from 'lucide-react';
import type { AgriDemoMetrics } from '@/lib/queries/quote-negotiations';

interface Props { metrics: AgriDemoMetrics; locale: 'vi' | 'en' }

function Card({
  icon: Icon, label, value, source,
}: { icon: typeof Sprout; label: string; value: string; source: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        <Icon size={13} /> {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1.5">{value}</p>
      <p className="text-[10px] font-mono text-gray-300 mt-1.5">{source}</p>
    </div>
  );
}

// Dải chỉ số riêng ngành nông dược cho demo — số THẬT tính từ DB (ai_logs /
// messages / quote_negotiations của UID khách demo), không phải số minh hoạ,
// để khách xem demo thấy ngay quy mô kiến thức + độ chính xác + tốc độ của AI.
export default function AgriMetricsStrip({ metrics, locale }: Props) {
  const en = locale === 'en';
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
      <Card
        icon={Sprout}
        label={en ? 'Products in catalog' : 'Sản phẩm trong catalog'}
        value={String(metrics.catalogProductCount)}
        source="product_prices · demo"
      />
      <Card
        icon={MessagesSquare}
        label={en ? 'Demo conversations' : 'Hội thoại khách demo'}
        value={String(metrics.conversationCount)}
        source="messages · demo_customer_uids"
      />
      <Card
        icon={Target}
        label={en ? 'AI answered accurately' : 'AI trả lời chính xác'}
        value={metrics.aiAnsweredRate != null ? `${metrics.aiAnsweredRate}%` : '—'}
        source="ai_logs · is_answered"
      />
      <Card
        icon={Zap}
        label={en ? 'Avg. response time' : 'Tốc độ phản hồi TB'}
        value={metrics.avgLatencyMs != null ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s` : '—'}
        source="ai_logs · latency_ms"
      />
      <Card
        icon={ReceiptText}
        label={en ? 'Quotes sent to customer' : 'Báo giá đã gửi khách'}
        value={String(metrics.quotesSentCount)}
        source="quote_negotiations"
      />
      <Card
        icon={Wallet}
        label={en ? 'Value closed via AI' : 'Giá trị đã chốt qua AI'}
        value={`${Math.round(metrics.totalQuotedValue).toLocaleString('vi-VN')}đ`}
        source="quote_negotiations · sent_to_customer"
      />
    </div>
  );
}
