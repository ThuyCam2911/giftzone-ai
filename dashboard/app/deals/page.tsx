export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import DealsPage from '@/components/DealsPage';
import { query } from '@/lib/db';

interface Deal {
  id: number;
  group_id: string;
  stage: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

interface DealEvent {
  customer_name: string | null;
  from_stage: string | null;
  to_stage: string;
  evidence: string | null;
  detected_at: string;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  return { from: fmt(from), to: fmt(to) };
}

async function getData(from: string, to: string) {
  const fromTs = `${from}T00:00:00+07:00`;
  const toTs = `${to}T23:59:59+07:00`;

  const [deals, events, groupRaw] = await Promise.all([
    query<Deal>(
      `SELECT id, group_id, stage, confidence, created_at, updated_at FROM deals
       WHERE created_at >= $1 AND created_at <= $2`,
      [fromTs, toTs]
    ),
    query<DealEvent>(
      `SELECT d.customer_name, de.from_stage, de.to_stage, de.evidence, de.detected_at
       FROM deal_events de JOIN deals d ON d.id = de.deal_id
       WHERE de.detected_at >= $1 AND de.detected_at <= $2
       ORDER BY de.detected_at DESC LIMIT 20`,
      [fromTs, toTs]
    ),
    query<{ group_id: string; stage: string; confidence: number; created_at: string }>(
      `SELECT group_id, stage, confidence, created_at FROM deals
       WHERE created_at >= $1 AND created_at <= $2`,
      [fromTs, toTs]
    ),
  ]);

  // Aggregate stats
  const total = deals.length;
  const active = deals.filter(d => !['Đã chốt', 'Thất bại'].includes(d.stage)).length;
  const closed = deals.filter(d => d.stage === 'Đã chốt').length;
  const failed = deals.filter(d => d.stage === 'Thất bại').length;
  const winRate = closed + failed > 0 ? Math.round((closed / (closed + failed)) * 100) : null;
  const avgConf = deals.length > 0
    ? deals.reduce((s, d) => s + d.confidence, 0) / deals.length
    : 0;

  // Group stats
  const byGroup = new Map<string, typeof groupRaw>();
  for (const d of groupRaw) {
    if (!byGroup.has(d.group_id)) byGroup.set(d.group_id, []);
    byGroup.get(d.group_id)!.push(d);
  }

  const groupStats = Array.from(byGroup.entries()).map(([group_id, ds]) => {
    const stageCounts: Record<string, number> = {};
    for (const d of ds) stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1;
    const top_stage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return {
      group_id,
      total_deals: ds.length,
      active_deals: ds.filter(d => !['Đã chốt', 'Thất bại'].includes(d.stage)).length,
      closed_deals: ds.filter(d => d.stage === 'Đã chốt').length,
      avg_confidence: ds.reduce((s, d) => s + d.confidence, 0) / ds.length,
      top_stage,
      new_deals: ds.filter(d => {
        const created = new Date(d.created_at);
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return created >= yesterday;
      }).length,
    };
  }).sort((a, b) => b.total_deals - a.total_deals);

  // Simple AI insight
  let aiInsight: string | null = null;
  if (groupStats.length > 0) {
    const lowConfGroup = groupStats.find(g => g.avg_confidence < 0.6);
    const stalledGroup = groupStats.find(g => g.active_deals > 3 && g.closed_deals === 0);
    const bestGroup = groupStats.find(g => g.closed_deals > 0);
    const insights: string[] = [];
    if (lowConfGroup)
      insights.push(`Nhóm ···${lowConfGroup.group_id.slice(-6)} có confidence trung bình thấp (${Math.round(lowConfGroup.avg_confidence * 100)}%) — agent chưa chắc chắn về stage. Đề xuất bổ sung ngữ cảnh hoặc xem lại hội thoại.`);
    if (stalledGroup)
      insights.push(`Nhóm ···${stalledGroup.group_id.slice(-6)} có ${stalledGroup.active_deals} deals đang active nhưng chưa chốt được deal nào — có thể cần coaching hoặc hỗ trợ thương lượng.`);
    if (bestGroup && !lowConfGroup && !stalledGroup)
      insights.push(`Nhóm ···${bestGroup.group_id.slice(-6)} đang hoạt động tốt nhất với ${bestGroup.closed_deals} deals đã chốt trong kỳ.`);
    if (insights.length === 0 && total > 0)
      insights.push(`Phát hiện ${total} deals trong kỳ, ${active} đang active. Win rate: ${winRate !== null ? `${winRate}%` : 'chưa có dữ liệu'}.`);
    aiInsight = insights.join(' ');
  }

  return {
    stats: { total, active, closed, winRate, avgConf },
    groupStats,
    events,
    aiInsight,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const defaults = defaultDateRange();
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;

  const data = await getData(from, to);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8 overflow-auto">
        <Suspense>
          <DealsPage {...data} dateFrom={from} dateTo={to} />
        </Suspense>
      </main>
    </div>
  );
}
