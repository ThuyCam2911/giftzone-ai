import { query } from '@/lib/db';
import { toRangeTimestamps, toVNDateString } from '@/lib/utils';
import type { SalesIssue, GroupQualityRow, DealsStats } from '@/types';
import type { Locale } from '@/lib/i18n/config';

export const ISSUE_LABELS: Record<string, string> = {
  no_reply:             'Chưa phản hồi',
  slow_reply:           'Chậm phản hồi',
  rude_behavior:        'Thái độ không tốt',
  customer_complaint:   'Khách phàn nàn',
  broken_promise:       'Hứa không giữ lời',
  missed_opportunity:   'Bỏ lỡ cơ hội',
  dropped_conversation: 'Hội thoại bỏ dở',
  low_engagement:       'Trả lời qua loa',
  negative_sentiment:   'Cảm xúc tiêu cực',
};

export const ISSUE_LABELS_EN: Record<string, string> = {
  no_reply:             'No reply',
  slow_reply:           'Slow reply',
  rude_behavior:        'Rude behavior',
  customer_complaint:   'Customer complaint',
  broken_promise:       'Broken promise',
  missed_opportunity:   'Missed opportunity',
  dropped_conversation: 'Dropped conversation',
  low_engagement:       'Low engagement',
  negative_sentiment:   'Negative sentiment',
};

export function getIssueLabels(locale: Locale): Record<string, string> {
  return locale === 'en' ? ISSUE_LABELS_EN : ISSUE_LABELS;
}

export function calcScore(
  critical: number,
  high: number,
  medium: number,
  low: number,
): number {
  return Math.max(0, Math.min(100, 100 - critical * 20 - high * 10 - medium * 5 - low * 2));
}

export interface DealsData {
  stats: DealsStats;
  issues: SalesIssue[];
  groups: GroupQualityRow[];
  aiInsight: string | null;
}

export async function getDealsData(from: string, to: string, locale: Locale = 'vi'): Promise<DealsData> {
  const labels = getIssueLabels(locale);
  const { fromTs, toTs } = toRangeTimestamps(from, to);
  const todayStart = toVNDateString(new Date()) + 'T00:00:00+07:00';

  const [issues, kpiResolvedToday, kpiTotal, groupStats, aiByGroup] = await Promise.all([
    query<SalesIssue>(
      `SELECT s.id, s.group_id, gn.name AS group_name, s.issue_key, s.issue_type,
              s.severity, s.title, s.description, s.evidence, s.status, s.detected_at, s.resolved_at
       FROM sales_issues s
       LEFT JOIN group_names gn ON gn.group_id = s.group_id
       WHERE s.detected_at >= $1 AND s.detected_at <= $2
         AND COALESCE(gn.group_type, 'customer') != 'internal'
       ORDER BY
         CASE s.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         s.detected_at DESC`,
      [fromTs, toTs],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM sales_issues WHERE status = 'resolved' AND resolved_at >= $1`,
      [todayStart],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM sales_issues`,
    ),
    query<{
      group_id: string;
      group_name: string | null;
      msg_count: string;
      open_issues: string;
      critical: string;
      high: string;
      medium: string;
      low: string;
      resolved_issues: string;
    }>(
      `SELECT
         g.group_id,
         gn.name AS group_name,
         g.msg_count,
         COALESCE(si.open_issues, 0)      AS open_issues,
         COALESCE(si.critical, 0)          AS critical,
         COALESCE(si.high, 0)              AS high,
         COALESCE(si.medium, 0)            AS medium,
         COALESCE(si.low, 0)               AS low,
         COALESCE(si.resolved_issues, 0)   AS resolved_issues
       FROM (
         SELECT group_id, COUNT(*) AS msg_count
         FROM messages WHERE msg_ts >= $1 AND msg_ts <= $2
         GROUP BY group_id
       ) g
       LEFT JOIN group_names gn ON gn.group_id = g.group_id
       LEFT JOIN (
         SELECT group_id,
           SUM(CASE WHEN status='open' THEN 1 ELSE 0 END)                             AS open_issues,
           SUM(CASE WHEN status='open' AND severity='critical' THEN 1 ELSE 0 END)     AS critical,
           SUM(CASE WHEN status='open' AND severity='high' THEN 1 ELSE 0 END)         AS high,
           SUM(CASE WHEN status='open' AND severity='medium' THEN 1 ELSE 0 END)       AS medium,
           SUM(CASE WHEN status='open' AND severity='low' THEN 1 ELSE 0 END)          AS low,
           SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END)                         AS resolved_issues
         FROM sales_issues WHERE detected_at >= $1 AND detected_at <= $2
         GROUP BY group_id
       ) si ON g.group_id = si.group_id
       WHERE COALESCE(gn.group_type, 'customer') != 'internal'
       ORDER BY g.msg_count DESC`,
      [fromTs, toTs],
    ),
    query<{ group_id: string; cnt: string }>(
      `SELECT group_id, COUNT(*) AS cnt FROM ai_logs
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY group_id`,
      [fromTs, toTs],
    ),
  ]);

  const aiMap = Object.fromEntries(aiByGroup.map(r => [r.group_id, Number(r.cnt)]));
  const groups: GroupQualityRow[] = groupStats.map(r => {
    const c = Number(r.critical), h = Number(r.high), m = Number(r.medium), l = Number(r.low);
    return {
      group_id:       r.group_id,
      group_name:     r.group_name ?? null,
      msg_count:      Number(r.msg_count),
      open_issues:    Number(r.open_issues),
      critical: c, high: h, medium: m, low: l,
      ai_queries:     aiMap[r.group_id] ?? 0,
      resolved_issues: Number(r.resolved_issues),
      quality_score:  calcScore(c, h, m, l),
    };
  });

  const openIssues    = issues.filter(i => i.status === 'open');
  const criticalCount = openIssues.filter(i => ['critical', 'high'].includes(i.severity)).length;
  const resolvedToday = Number(kpiResolvedToday[0]?.count ?? 0);
  const totalAllTime  = Number(kpiTotal[0]?.count ?? 0);
  const avgScore      = groups.length === 0
    ? 100
    : Math.round(groups.reduce((s, g) => s + g.quality_score, 0) / groups.length);

  let aiInsight: string | null = null;
  if (issues.length > 0) {
    const insights: string[] = [];
    const typeCounts: Record<string, number> = {};
    for (const i of openIssues) typeCounts[i.issue_type] = (typeCounts[i.issue_type] ?? 0) + 1;
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (locale === 'en') {
      if (criticalCount > 0)
        insights.push(`There are ${criticalCount} high/critical issues open — needs immediate attention.`);
      if (topType)
        insights.push(`Most common issue: "${labels[topType[0]] ?? topType[0]}" (${topType[1]} times).`);
      if (resolvedToday > 0)
        insights.push(`${resolvedToday} issue(s) auto-resolved today.`);
      if (insights.length === 0)
        insights.push(`${issues.length} issue(s) detected this period. No severe issues currently open.`);
    } else {
      if (criticalCount > 0)
        insights.push(`Có ${criticalCount} issues mức độ high/critical đang mở — cần xử lý ngay.`);
      if (topType)
        insights.push(`Issue phổ biến nhất: "${labels[topType[0]] ?? topType[0]}" (${topType[1]} lần).`);
      if (resolvedToday > 0)
        insights.push(`Hôm nay đã tự giải quyết ${resolvedToday} issue.`);
      if (insights.length === 0)
        insights.push(`Phát hiện ${issues.length} issues trong kỳ. Không có issue nghiêm trọng nào đang mở.`);
    }
    aiInsight = insights.join(' ');
  }

  return {
    stats: { openCount: openIssues.length, criticalCount, resolvedToday, totalAllTime, avgScore },
    issues,
    groups,
    aiInsight,
  };
}
