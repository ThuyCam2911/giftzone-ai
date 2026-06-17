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

interface GroupRow {
  group_id: string;
  msg_count: number;
  open_issues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  ai_queries: number;
  resolved_issues: number;
  quality_score: number;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  return { from: fmt(from), to: fmt(to) };
}

// Điểm chất lượng: 100 điểm cơ bản, trừ điểm theo issue severity
// critical=-20, high=-10, medium=-5, low=-2
function calcScore(critical: number, high: number, medium: number, low: number): number {
  const score = 100 - critical * 20 - high * 10 - medium * 5 - low * 2;
  return Math.max(0, Math.min(100, score));
}

export const ISSUE_LABELS: Record<string, string> = {
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
  const toTs   = `${to}T23:59:59+07:00`;
  const todayStart = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) + 'T00:00:00+07:00';

  const [issues, kpiResolvedToday, kpiTotal, groupStats, aiByGroup] = await Promise.all([
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
    // Group breakdown: msg count + open issues per group
    query<{ group_id: string; msg_count: string; open_issues: string; critical: string; high: string; medium: string; low: string; resolved_issues: string }>(
      `SELECT
         g.group_id,
         g.msg_count,
         COALESCE(si.open_issues, 0) AS open_issues,
         COALESCE(si.critical, 0)    AS critical,
         COALESCE(si.high, 0)        AS high,
         COALESCE(si.medium, 0)      AS medium,
         COALESCE(si.low, 0)         AS low,
         COALESCE(si.resolved_issues, 0) AS resolved_issues
       FROM (
         SELECT group_id, COUNT(*) AS msg_count
         FROM messages WHERE msg_ts >= $1 AND msg_ts <= $2
         GROUP BY group_id
       ) g
       LEFT JOIN (
         SELECT group_id,
           SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open_issues,
           SUM(CASE WHEN status='open' AND severity='critical' THEN 1 ELSE 0 END) AS critical,
           SUM(CASE WHEN status='open' AND severity='high' THEN 1 ELSE 0 END) AS high,
           SUM(CASE WHEN status='open' AND severity='medium' THEN 1 ELSE 0 END) AS medium,
           SUM(CASE WHEN status='open' AND severity='low' THEN 1 ELSE 0 END) AS low,
           SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) AS resolved_issues
         FROM sales_issues WHERE detected_at >= $1 AND detected_at <= $2
         GROUP BY group_id
       ) si ON g.group_id = si.group_id
       ORDER BY g.msg_count DESC`,
      [fromTs, toTs]
    ),
    query<{ group_id: string; cnt: string }>(
      `SELECT group_id, COUNT(*) AS cnt FROM ai_logs
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY group_id`,
      [fromTs, toTs]
    ),
  ]);

  // Merge ai_queries into group rows
  const aiMap = Object.fromEntries(aiByGroup.map(r => [r.group_id, Number(r.cnt)]));
  const groups: GroupRow[] = groupStats.map(r => {
    const c = Number(r.critical), h = Number(r.high), m = Number(r.medium), l = Number(r.low);
    return {
      group_id: r.group_id,
      msg_count: Number(r.msg_count),
      open_issues: Number(r.open_issues),
      critical: c, high: h, medium: m, low: l,
      ai_queries: aiMap[r.group_id] ?? 0,
      resolved_issues: Number(r.resolved_issues),
      quality_score: calcScore(c, h, m, l),
    };
  });

  const openIssues = issues.filter(i => i.status === 'open');
  const criticalCount = openIssues.filter(i => ['critical', 'high'].includes(i.severity)).length;
  const resolvedToday = Number(kpiResolvedToday[0]?.count ?? 0);
  const totalAllTime  = Number(kpiTotal[0]?.count ?? 0);

  // Overall quality score: average across all groups
  const avgScore = groups.length === 0
    ? 100
    : Math.round(groups.reduce((s, g) => s + g.quality_score, 0) / groups.length);

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
    stats: { openCount: openIssues.length, criticalCount, resolvedToday, totalAllTime, avgScore },
    issues,
    groups,
    aiInsight,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params   = await searchParams;
  const defaults = defaultDateRange();
  const from = params.from ?? defaults.from;
  const to   = params.to   ?? defaults.to;

  const data = await getData(from, to);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <Suspense>
          <DealsPage {...data} dateFrom={from} dateTo={to} issueLabels={ISSUE_LABELS} />
        </Suspense>
      </main>
    </div>
  );
}
