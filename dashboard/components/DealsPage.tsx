'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, Siren, CheckCircle2, BarChart2, Star,
  ChevronUp, ChevronDown, ChevronsUpDown, type LucideIcon,
} from 'lucide-react';

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#fef2f2', color: '#b91c1c', label: 'Khẩn cấp' },
  high:     { bg: '#fff7ed', color: '#c2410c', label: 'Cao' },
  medium:   { bg: '#fffbeb', color: '#b45309', label: 'Trung bình' },
  low:      { bg: '#f9fafb', color: '#6b7280', label: 'Thấp' },
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open:     { bg: '#fef2f2', color: '#b91c1c', label: 'Đang mở' },
  resolved: { bg: '#f0fdf4', color: '#166534', label: 'Đã giải quyết' },
};

interface SalesIssue {
  id: number;
  group_id: string;
  group_name: string | null;
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
  group_name: string | null;
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

interface Props {
  stats: { openCount: number; criticalCount: number; resolvedToday: number; totalAllTime: number; avgScore: number };
  issues: SalesIssue[];
  groups: GroupRow[];
  aiInsight: string | null;
  dateFrom: string;
  dateTo: string;
  issueLabels: Record<string, string>;
}

function scoreColor(score: number) {
  if (score >= 80) return { color: '#166534', bg: '#f0fdf4' };
  if (score >= 60) return { color: '#b45309', bg: '#fffbeb' };
  return { color: '#b91c1c', bg: '#fef2f2' };
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Tốt';
  if (score >= 60) return 'Cần chú ý';
  return 'Kém';
}

const GROUP_PAGE_SIZE = 10;

type SortKey = 'msg_count' | 'quality_score' | 'open_issues' | 'ai_queries';

export default function DealsPage({ stats, issues, groups, aiInsight, dateFrom, dateTo, issueLabels }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [groupPage, setGroupPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('msg_count');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('');

  function applyFilter() {
    const p = new URLSearchParams(searchParams.toString());
    p.set('from', from);
    p.set('to', to);
    startTransition(() => router.push(`/deals?${p.toString()}`));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
    setGroupPage(1);
  }

  const recentFeed = [...issues]
    .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
    .slice(0, 15);

  // Group table: filter + sort + paginate
  const filteredGroups = groups.filter(g =>
    filterSeverity === ''
      ? true
      : filterSeverity === 'warning' ? g.open_issues > 0
      : filterSeverity === 'critical' ? g.critical > 0 || g.high > 0
      : true
  ).sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });
  const groupPages = Math.ceil(filteredGroups.length / GROUP_PAGE_SIZE);
  const pagedGroups = filteredGroups.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE);

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const SortIcon = sortKey === k ? (sortAsc ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <button onClick={() => toggleSort(k)} className="flex items-center gap-1 group">
        {label}
        <SortIcon size={12} className="text-gray-300 group-hover:text-gray-500" />
      </button>
    );
  };

  return (
    <>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Chất lượng hội thoại</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI phân tích chất lượng cuộc hội thoại với khách hàng · cập nhật mỗi 15 phút</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
            <span className="text-gray-400 text-xs">—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
            <button onClick={applyFilter}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
              style={{ background: '#02AD64' }}>
              Lọc
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 md:px-8 pt-6 space-y-6">
        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {([
            { label: 'Issues đang mở',     value: stats.openCount,     Icon: AlertTriangle,  color: '#FF6900', bg: '#fff3eb' },
            { label: 'Nghiêm trọng / Cao', value: stats.criticalCount, Icon: Siren,          color: '#ef4444', bg: '#fef2f2' },
            { label: 'Giải quyết hôm nay', value: stats.resolvedToday, Icon: CheckCircle2,   color: '#02AD64', bg: '#e6f9f1' },
            { label: 'Tổng phát hiện',     value: stats.totalAllTime,  Icon: BarChart2,      color: '#6366f1', bg: '#eef2ff' },
          ] as { label: string; value: number; Icon: LucideIcon; color: string; bg: string }[]).map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{card.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                  <card.Icon size={16} style={{ color: card.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}

          {/* Quality score card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">Điểm chất lượng</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#fffbeb' }}>
                <Star size={16} style={{ color: '#f59e0b' }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: scoreColor(stats.avgScore).color }}>
              {stats.avgScore}/100
            </p>
            <p className="text-xs mt-1 font-medium px-2 py-0.5 rounded-full inline-block"
              style={scoreColor(stats.avgScore)}>
              {scoreLabel(stats.avgScore)}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              −20/critical · −10/high · −5/med · −2/low
            </p>
          </div>
        </div>

        {/* ── Group breakdown table ── */}
        <div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">Hoạt động & Chất lượng theo nhóm</h2>
            <div className="flex items-center gap-2">
              <select value={filterSeverity} onChange={e => { setFilterSeverity(e.target.value); setGroupPage(1); }}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">Tất cả nhóm</option>
                <option value="warning">Có issue</option>
                <option value="critical">Có critical/high</option>
              </select>
              <span className="text-xs text-gray-400">{filteredGroups.length} nhóm</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredGroups.length === 0 ? (
              <div className="py-12 text-center px-4">
                <p className="text-sm text-gray-400">Chưa có dữ liệu nhóm trong kỳ này.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">NHÓM</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                          <SortBtn k="msg_count" label="TIN NHẮN" />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                          <SortBtn k="quality_score" label="CHẤT LƯỢNG TB" />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                          <SortBtn k="ai_queries" label="AGENT QUERY" />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                          <SortBtn k="open_issues" label="AGENT RESOLVE" />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">CẢNH BÁO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedGroups.map(g => {
                        const sc = scoreColor(g.quality_score);
                        return (
                          <tr key={g.group_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs">
                              {g.group_name
                                ? <span className="text-gray-800 font-medium">{g.group_name}</span>
                                : <span className="font-mono text-gray-400">···{g.group_id.slice(-8)}</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">{g.msg_count.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{ background: sc.bg, color: sc.color }}>
                                {g.quality_score}/100
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{g.ai_queries}</td>
                            <td className="px-4 py-3 text-gray-700">{g.resolved_issues}</td>
                            <td className="px-4 py-3">
                              {g.critical > 0 && (
                                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full mr-1"
                                  style={{ background: '#fef2f2', color: '#b91c1c' }}>
                                  {g.critical} khẩn cấp
                                </span>
                              )}
                              {g.high > 0 && (
                                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full mr-1"
                                  style={{ background: '#fff7ed', color: '#c2410c' }}>
                                  {g.high} cao
                                </span>
                              )}
                              {g.critical === 0 && g.high === 0 && g.open_issues === 0 && (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {groupPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      Trang {groupPage}/{groupPages} · {filteredGroups.length} nhóm
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setGroupPage(p => Math.max(1, p - 1))}
                        disabled={groupPage === 1}
                        className="px-2.5 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                        ‹ Trước
                      </button>
                      <button onClick={() => setGroupPage(p => Math.min(groupPages, p + 1))}
                        disabled={groupPage === groupPages}
                        className="px-2.5 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                        Sau ›
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Issue table ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Danh sách issues</h2>
            <span className="text-xs text-gray-400 hidden sm:block">{issues.length} issues trong kỳ</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {issues.length === 0 ? (
              <div className="py-14 text-center px-4">
                <div className="flex justify-center mb-2">
                  <CheckCircle2 size={36} style={{ color: '#02AD64' }} strokeWidth={1.5} />
                </div>
                <p className="text-sm text-gray-500 font-medium">Không có issue nào trong kỳ này</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  Agent đang giám sát — issues sẽ xuất hiện khi phát hiện vấn đề trong hội thoại.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">NHÓM</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">LOẠI</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">MỨC ĐỘ</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">MÔ TẢ</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">TRẠNG THÁI</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">PHÁT HIỆN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {issues.map(issue => {
                      const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.medium;
                      const sts = STATUS_STYLE[issue.status] ?? STATUS_STYLE.open;
                      const isExpanded = expanded === issue.id;
                      return (
                        <React.Fragment key={issue.id}>
                          <tr className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setExpanded(isExpanded ? null : issue.id)}>
                            <td className="px-4 py-3 text-xs">
                              {issue.group_name
                                ? <span className="text-gray-800 font-medium">{issue.group_name}</span>
                                : <span className="font-mono text-gray-400">···{issue.group_id.slice(-8)}</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {issueLabels[issue.issue_type] ?? issue.issue_type}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full"
                                style={{ background: sev.bg, color: sev.color }}>
                                {sev.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs">
                              <p className="line-clamp-1">{issue.title}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full"
                                style={{ background: sts.bg, color: sts.color }}>
                                {sts.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {new Date(issue.detected_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${issue.id}-detail`} className="bg-gray-50">
                              <td colSpan={6} className="px-4 py-3">
                                {issue.description && (
                                  <p className="text-xs text-gray-600 mb-1">
                                    <span className="font-medium">Giải thích:</span> {issue.description}
                                  </p>
                                )}
                                {issue.evidence && (
                                  <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded p-2 font-mono mt-1 whitespace-pre-wrap">
                                    {issue.evidence}
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom: AI Insight + Activity feed ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-indigo-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-100"
              style={{ background: 'linear-gradient(135deg, #6366f108, #8b5cf608)' }}>
              <span className="text-indigo-500 text-xs font-semibold tracking-wide">✦ Nhận xét tự động</span>
            </div>
            <div className="p-4 bg-white">
              {aiInsight ? (
                <>
                  <p className="text-sm text-gray-700 leading-relaxed">{aiInsight}</p>
                  <p className="text-xs text-gray-400 mt-3">Tự động · dữ liệu từ hội thoại Zalo</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  Chưa đủ dữ liệu — nhận xét sẽ hiện sau khi agent phân tích được ít nhất một nhóm.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cập nhật gần đây</span>
              <span className="text-xs text-gray-400">{recentFeed.length} issues</span>
            </div>
            <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {recentFeed.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Chưa có issue nào trong kỳ này.</p>
              ) : recentFeed.map((issue, i) => {
                const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.medium;
                return (
                  <div key={issue.id} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-2 h-2 rounded-full mt-1" style={{ background: sev.color }} />
                      {i < recentFeed.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                    </div>
                    <div className="pb-2 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{issue.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: sev.color }}>
                        {sev.label} · {issueLabels[issue.issue_type] ?? issue.issue_type}
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(issue.detected_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
