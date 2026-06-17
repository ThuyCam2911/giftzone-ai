'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  issue_type: string;
  severity: string;
  title: string;
  description: string | null;
  evidence: string | null;
  status: string;
  detected_at: string;
  resolved_at: string | null;
}

interface Props {
  stats: { openCount: number; criticalCount: number; resolvedToday: number; totalAllTime: number };
  issues: SalesIssue[];
  aiInsight: string | null;
  dateFrom: string;
  dateTo: string;
  issueLabels: Record<string, string>;
}

export default function DealsPage({ stats, issues, aiInsight, dateFrom, dateTo, issueLabels }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);
  const [expanded, setExpanded] = useState<number | null>(null);

  function applyFilter() {
    const p = new URLSearchParams(searchParams.toString());
    p.set('from', from);
    p.set('to', to);
    startTransition(() => router.push(`/deals?${p.toString()}`));
  }

  const recentFeed = [...issues].sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  ).slice(0, 15);

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-0 sm:mb-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Giám sát chất lượng Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI đọc hội thoại Zalo và phát hiện issues · cập nhật mỗi 15 phút
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
          <button onClick={applyFilter}
            className="text-sm font-medium px-4 py-1.5 rounded-lg text-white"
            style={{ background: '#02AD64' }}>
            Lọc
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Issues đang mở',      value: stats.openCount,     icon: '⚠️', color: '#FF6900' },
          { label: 'Nghiêm trọng / Cao',  value: stats.criticalCount, icon: '🚨', color: '#ef4444' },
          { label: 'Giải quyết hôm nay',  value: stats.resolvedToday, icon: '✅', color: '#02AD64' },
          { label: 'Tổng phát hiện',       value: stats.totalAllTime,  icon: '📊', color: '#6366f1' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">src · phân tích AI</p>
          </div>
        ))}
      </div>

      {/* ── Issue table ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Danh sách issues</h2>
          <span className="text-xs text-gray-400 hidden sm:block">{issues.length} issues trong kỳ</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {issues.length === 0 ? (
            <div className="py-14 text-center px-4">
              <div className="text-3xl mb-2">✅</div>
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
                          <td className="px-4 py-3 text-gray-700">
                            <span className="font-mono text-xs text-gray-400">···</span>
                            {issue.group_id.slice(-8)}
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
        {/* AI Insight */}
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

        {/* Activity feed */}
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
                    {issue.evidence && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 font-mono">{issue.evidence}</p>
                    )}
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
    </>
  );
}
