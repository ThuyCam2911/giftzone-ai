export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import { query } from '@/lib/db';

interface Deal {
  id: number;
  group_id: string;
  deal_key: string;
  customer_name: string | null;
  product: string | null;
  stage: string;
  confidence: number;
  last_analyzed_at: string;
  created_at: string;
}

interface DealEvent {
  id: number;
  deal_id: number;
  from_stage: string | null;
  to_stage: string;
  evidence: string | null;
  detected_at: string;
}

const STAGES = ['Mới', 'Tư vấn', 'Thương lượng', 'Chờ chốt', 'Đã chốt', 'Thất bại'];

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Mới':         { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', dot: '#38bdf8' },
  'Tư vấn':     { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#4ade80' },
  'Thương lượng': { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#fbbf24' },
  'Chờ chốt':   { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
  'Đã chốt':    { bg: '#f0fdf4', border: '#86efac', text: '#166534', dot: '#02AD64' },
  'Thất bại':   { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#f87171' },
};

async function getDeals() {
  const deals = await query<Deal>(
    `SELECT id, group_id, deal_key, customer_name, product, stage, confidence, last_analyzed_at, created_at
     FROM deals ORDER BY updated_at DESC`
  );
  return deals;
}

async function getRecentEvents() {
  const events = await query<DealEvent & { customer_name: string | null }>(
    `SELECT de.id, de.deal_id, de.from_stage, de.to_stage, de.evidence, de.detected_at,
            d.customer_name
     FROM deal_events de
     JOIN deals d ON d.id = de.deal_id
     ORDER BY de.detected_at DESC
     LIMIT 20`
  );
  return events;
}

async function getStats() {
  const [total, closed, failed, active] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM deals`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM deals WHERE stage = 'Đã chốt'`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM deals WHERE stage = 'Thất bại'`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM deals WHERE stage NOT IN ('Đã chốt', 'Thất bại')`),
  ]);
  return {
    total: Number(total[0]?.count ?? 0),
    closed: Number(closed[0]?.count ?? 0),
    failed: Number(failed[0]?.count ?? 0),
    active: Number(active[0]?.count ?? 0),
  };
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#02AD64' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: color + '20', color }}>
      {pct}%
    </span>
  );
}

export default async function DealsPage() {
  const [deals, events, stats] = await Promise.all([getDeals(), getRecentEvents(), getStats()]);

  const byStage: Record<string, Deal[]> = Object.fromEntries(STAGES.map(s => [s, []]));
  for (const d of deals) {
    if (byStage[d.stage]) byStage[d.stage].push(d);
    else byStage['Mới'].push(d);
  }

  const winRate = stats.closed + stats.failed > 0
    ? Math.round((stats.closed / (stats.closed + stats.failed)) * 100)
    : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Deal Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tự động phân tích từ hội thoại Zalo · Cập nhật mỗi 15 phút</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Tổng deals', value: stats.total, icon: '📋', color: '#6366f1' },
            { label: 'Đang active', value: stats.active, icon: '🔥', color: '#FF6900' },
            { label: 'Đã chốt', value: stats.closed, icon: '✅', color: '#02AD64' },
            { label: 'Win rate', value: winRate !== null ? `${winRate}%` : '—', icon: '🏆', color: '#f59e0b' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase">{card.label}</span>
                <span className="text-lg">{card.icon}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>

        {deals.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-600 font-medium">Chưa có deal nào được phát hiện</p>
            <p className="text-sm text-gray-400 mt-1">
              Agent sẽ tự động phân tích hội thoại Zalo mỗi 15 phút và hiển thị deals tại đây.
            </p>
          </div>
        ) : (
          <>
            {/* Pipeline kanban */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Pipeline</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {STAGES.map(stage => {
                  const c = STAGE_COLORS[stage];
                  const stageDeals = byStage[stage] ?? [];
                  return (
                    <div key={stage} className="flex-shrink-0 w-52">
                      {/* Stage header */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
                        <span className="text-xs font-semibold text-gray-600">{stage}</span>
                        <span className="ml-auto text-xs text-gray-400">{stageDeals.length}</span>
                      </div>

                      {/* Cards */}
                      <div className="space-y-2 min-h-12">
                        {stageDeals.map(deal => (
                          <div key={deal.id} className="rounded-lg border p-3 text-sm"
                            style={{ background: c.bg, borderColor: c.border }}>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <p className="font-semibold text-gray-800 leading-tight truncate">
                                {deal.customer_name ?? 'Khách hàng'}
                              </p>
                              <ConfidenceBadge value={deal.confidence} />
                            </div>
                            {deal.product && (
                              <p className="text-xs text-gray-500 truncate mb-1">{deal.product}</p>
                            )}
                            <p className="text-xs" style={{ color: c.text }}>
                              Group ···{deal.group_id.slice(-4)}
                            </p>
                          </div>
                        ))}
                        {stageDeals.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center">
                            <span className="text-xs text-gray-300">Trống</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Two-column: Deal list + Recent activity */}
            <div className="grid grid-cols-3 gap-6">
              {/* Deal list — 2/3 */}
              <div className="col-span-2">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Tất cả deals</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Stage</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Confidence</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deals.map(deal => {
                        const c = STAGE_COLORS[deal.stage] ?? STAGE_COLORS['Mới'];
                        return (
                          <tr key={deal.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {deal.customer_name ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                              {deal.product ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                                {deal.stage}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ConfidenceBadge value={deal.confidence} />
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {formatDate(deal.last_analyzed_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent events — 1/3 */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Hoạt động gần đây</h2>
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  {events.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Chưa có sự kiện</p>
                  )}
                  {events.map(ev => {
                    const isNew = ev.from_stage === null;
                    const toC = STAGE_COLORS[ev.to_stage] ?? STAGE_COLORS['Mới'];
                    return (
                      <div key={ev.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{ background: toC.dot }} />
                          <div className="w-px flex-1 bg-gray-100 mt-1" />
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {ev.customer_name ?? 'Khách hàng'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isNew ? (
                              <>Deal mới · <span style={{ color: toC.text }}>{ev.to_stage}</span></>
                            ) : (
                              <><span className="line-through text-gray-300">{ev.from_stage}</span>{' → '}<span style={{ color: toC.text }}>{ev.to_stage}</span></>
                            )}
                          </p>
                          {ev.evidence && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ev.evidence}</p>
                          )}
                          <p className="text-xs text-gray-300 mt-0.5">{formatDate(ev.detected_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
