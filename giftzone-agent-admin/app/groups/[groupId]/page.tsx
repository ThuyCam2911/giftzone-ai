export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getGroupDetail } from '@/lib/queries/group-detail';
import { ISSUE_LABELS } from '@/lib/queries/deals';
import { timeAgo } from '@/lib/utils';
import { ArrowLeft, MessageSquare, Bot, AlertTriangle, Users, Sparkles, Webhook } from 'lucide-react';

const SEV: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#fef2f2', color: '#b91c1c', label: 'Khẩn cấp' },
  high:     { bg: '#fff7ed', color: '#c2410c', label: 'Cao' },
  medium:   { bg: '#fffbeb', color: '#b45309', label: 'Trung bình' },
  low:      { bg: '#f9fafb', color: '#6b7280', label: 'Thấp' },
};

const GROUP_TYPE_LABEL: Record<string, string> = {
  customer: 'Khách hàng',
  internal: 'Nội bộ',
};

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const data = await getGroupDetail(groupId);

  const groupName = data.group?.name ?? groupId;
  const groupType = data.group?.group_type ?? 'customer';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <Link href="/groups" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-2">
            <ArrowLeft size={12} /> Quay lại
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 truncate">{groupName}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
              {GROUP_TYPE_LABEL[groupType] ?? groupType}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">ID: {groupId}</p>
        </div>

        <div className="px-4 pb-8 md:px-8 pt-6 space-y-6 max-w-3xl">

          {/* ── Demo banner ── */}
          {groupId.startsWith('demo-') && (
            <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
              style={{ background: '#e6f9f1', borderColor: '#02AD64' }}>
              <Webhook size={16} className="text-[#018a4e] mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#018a4e' }}>
                  Đây là dữ liệu vừa được đồng bộ qua Webhook từ hội thoại minh họa zEnterprise
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#018a4e' }}>
                  Tin nhắn, KPI và phân tích AI bên dưới được ghi trực tiếp vào cùng hệ thống dữ liệu production — không phải màn hình dựng riêng cho demo.
                </p>
              </div>
              <Link href="/demo" className="flex items-center gap-1 text-xs font-medium shrink-0 px-2.5 py-1.5 rounded-lg bg-white"
                style={{ color: '#018a4e' }}>
                <Sparkles size={12} /> Demo mới
              </Link>
            </div>
          )}

          {/* ── KPI row ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: MessageSquare, label: 'Tổng tin nhắn', value: data.msgStats.total.toLocaleString() },
              { icon: MessageSquare, label: '7 ngày qua',    value: data.msgStats.last7Days.toLocaleString() },
              { icon: Bot,           label: 'Lần hỏi AI',   value: data.aiLogs.length + (data.aiLogs.length === 20 ? '+' : '') },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Open issues ── */}
          {data.openIssues.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                Issues đang mở ({data.openIssues.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {data.openIssues.map(issue => {
                  const sev = SEV[issue.severity] ?? SEV.low;
                  return (
                    <div key={issue.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{issue.title}</p>
                          {issue.evidence && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">"{issue.evidence}"</p>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium"
                          style={{ background: sev.bg, color: sev.color }}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {ISSUE_LABELS[issue.issue_type] ?? issue.issue_type} · {timeAgo(issue.detected_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Top senders ── */}
          {data.topSenders.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                Người nhắn tin nhiều nhất
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {data.topSenders.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-gray-300 w-4 text-right shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-800">{s.sender_name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{s.msg_count} tin</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── AI log ── */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Bot size={14} className="text-gray-400" />
              AI Log gần nhất
            </h2>
            {data.aiLogs.length === 0 ? (
              <p className="text-xs text-gray-400 py-4">Chưa có câu hỏi nào trong nhóm này.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {data.aiLogs.map(log => (
                  <div key={log.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 truncate">Q: {log.query}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">A: {log.answer}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-gray-400">{timeAgo(log.created_at)}</span>
                      <span className="text-[10px] text-gray-400">{log.latency_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
