export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import DealsPage from '@/components/DealsPage';
import { query } from '@/lib/db';

interface SalesIssue {
  id: number;
  group_id: string;
  issue_key: string;
  issue_type: string;
  severity: string;
  title: string;
  description: string | null;
  evidence: string | null;
  status: string;
  detected_at: string;
  resolved_at: string | null;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  return { from: fmt(from), to: fmt(to) };
}

const ISSUE_LABELS: Record<string, string> = {
  no_reply: 'Chưa phản hồi',
  slow_reply: 'Chậm phản hồi',
  rude_behavior: 'Thái độ không tốt',
  customer_complaint: 'Khách phàn nàn',
  broken_promise: 'Hứa không giữ lời',
  missed_opportunity: 'Bỏ lỡ cơ hội',
  dropped_conversation: 'Hội thoại bỏ dở',
  low_engagement: 'Trả lời qua loa',
  negative_sentiment: 'Cảm xúc tiêu cực',
};

async function getData(from: string, to: string) {
  const fromTs = `${from}T00:00:00+07:00`;
  const toTs = `${to}T23:59:59+07:00`;
  const todayStart = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) + 'T00:00:00+07:00';

  const [issues, kpiResolvedToday, kpiTotal] = await Promise.all([
    query<SalesIssue>(
      `SELECT id, group_id, issue_key, issue_type, severity, title, description, evidence, status, detected_at, resolved_at
       FROM sales_issues
       WHERE detected_at >= $1 AND detected_at <= $2
       ORDER BY
         CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         detected_at DESC`,
      [fromTs, toTs]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM sales_issues WHERE status = 'resolved' AND resolved_at >= $1`,
      [todayStart]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM sales_issues`
    ),
  ]);

  const openIssues = issues.filter(i => i.status === 'open');
  const criticalCount = openIssues.filter(i => ['critical', 'high'].includes(i.severity)).length;
  const resolvedToday = Number(kpiResolvedToday[0]?.count ?? 0);
  const totalAllTime = Number(kpiTotal[0]?.count ?? 0);

  // AI Insight tổng hợp
  let aiInsight: string | null = null;
  if (issues.length > 0) {
    const insights: string[] = [];
    const typeCounts: Record<string, number> = {};
    for (const i of openIssues) typeCounts[i.issue_type] = (typeCounts[i.issue_type] ?? 0) + 1;
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (criticalCount > 0)
      insights.push(`Có ${criticalCount} issues mức độ high/critical đang mở — cần xử lý ngay.`);
    if (topType)
      insights.push(`Issue phổ biến nhất: "${ISSUE_LABELS[topType[0]] ?? topType[0]}" (${topType[1]} lần).`);
    if (resolvedToday > 0)
      insights.push(`Hôm nay đã tự giải quyết ${resolvedToday} issue.`);
    if (insights.length === 0)
      insights.push(`Phát hiện ${issues.length} issues trong kỳ. Không có issue nghiêm trọng nào đang mở.`);
    aiInsight = insights.join(' ');
  }

  return {
    stats: {
      openCount: openIssues.length,
      criticalCount,
      resolvedToday,
      totalAllTime,
    },
    issues,
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
      <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8 overflow-auto min-w-0">
        <Suspense>
          <DealsPage {...data} dateFrom={from} dateTo={to} issueLabels={ISSUE_LABELS} />
        </Suspense>
      </main>
    </div>
  );
}
