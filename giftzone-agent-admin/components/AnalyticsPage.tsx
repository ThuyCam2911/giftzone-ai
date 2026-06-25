'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WeekChart } from '@/components/ui';
import {
  MessageSquare, Zap, TrendingUp, FileText, Flame, HelpCircle,
  AlertCircle, Clock, type LucideIcon,
} from 'lucide-react';

interface ResponseTimeRow {
  sender_uid: string;
  sender_name: string;
  role: string;
  msg_count: number;
  group_count: number;
  avg_response_min: number | null;
}

interface Props {
  topQuestions: { question: string; cnt: number }[];
  groupUsage: { group_id: string; group_name: string | null; cnt: number; avg_ms: number }[];
  docUsage: { src: string; cnt: number }[];
  latency: { p50: number; p95: number; maxMs: number; total: number };
  days7: { label: string; count: number }[];
  unanswered: { question: string; cnt: number }[];
  unansweredTotal: number;
  responseTimes: ResponseTimeRow[];
}

function sanitizeQuery(q: string) {
  if (q.startsWith('{') || q.startsWith('[')) return '[Sticker / file đính kèm]';
  return q.length > 100 ? q.slice(0, 100) + '…' : q;
}

const ROLE_LABEL: Record<string, string> = { sales: 'Sales', cs: 'CS', manager: 'Manager', technical: 'Tech' };
const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  sales:     { bg: '#e6f9f1', color: '#018a4e' },
  cs:        { bg: '#eef2ff', color: '#4338ca' },
  manager:   { bg: '#fff3eb', color: '#c2410c' },
  technical: { bg: '#f0fdf4', color: '#166534' },
};

function formatResponseTime(min: number | null) {
  if (min === null) return '—';
  if (min < 1) return '< 1 phút';
  if (min < 60) return `${min} phút`;
  return `${Math.round(min / 60)} giờ`;
}

export default function AnalyticsPage({
  topQuestions, groupUsage, docUsage, latency, days7, unanswered, unansweredTotal, responseTimes,
}: Props) {
  const [tab, setTab] = useState<'top' | 'unanswered'>('top');

  const totalWeek = days7.reduce((s, d) => s + d.count, 0);
  const uniqueDocs = docUsage.length;
  const qualityPct = latency.total > 0
    ? Math.round(((latency.total - unansweredTotal) / latency.total) * 100)
    : 100;
  const qualityColor = qualityPct >= 80 ? '#02AD64' : qualityPct >= 60 ? '#FF6900' : '#b91c1c';
  const qualityBg    = qualityPct >= 80 ? '#e6f9f1' : qualityPct >= 60 ? '#fff3eb' : '#fef2f2';

  return (
    <>
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {([
          { label: 'Câu hỏi / 7 ngày',  value: totalWeek,              Icon: MessageSquare, color: '#02AD64', bg: '#e6f9f1' },
          { label: 'Latency p50',        value: `${latency.p50}ms`,     Icon: Zap,           color: '#6366f1', bg: '#eef2ff' },
          { label: 'Latency p95',        value: `${latency.p95}ms`,     Icon: TrendingUp,    color: '#FF6900', bg: '#fff3eb' },
          { label: 'Tài liệu được dùng', value: uniqueDocs,             Icon: FileText,      color: '#0ea5e9', bg: '#e0f2fe' },
        ] as { label: string; value: string | number; Icon: LucideIcon; color: string; bg: string }[]).map(card => (
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
      </div>

      {/* ── Quality score banner ── */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Chất lượng phản hồi AI</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {latency.total - unansweredTotal} / {latency.total} câu hỏi được trả lời đầy đủ trong 7 ngày qua
          </p>
        </div>
        <div className="shrink-0 text-center">
          <p className="text-3xl font-bold" style={{ color: qualityColor }}>{qualityPct}%</p>
          <p className="text-[10px] mt-0.5 px-2 py-0.5 rounded-full font-medium"
            style={{ background: qualityBg, color: qualityColor }}>
            {qualityPct >= 80 ? 'Tốt' : qualityPct >= 60 ? 'Cần cải thiện' : 'Kém'}
          </p>
        </div>
      </div>

      {/* ── Volume chart ── */}
      <div className="mb-6">
        <WeekChart days={days7} />
      </div>

      {/* ── Questions tab ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="flex items-center gap-0 border-b border-gray-200">
          {(['top', 'unanswered'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-3 text-sm font-medium transition-colors"
              style={tab === t
                ? { color: '#02AD64', borderBottom: '2px solid #02AD64', background: '#f9fafb' }
                : { color: '#6b7280', borderBottom: '2px solid transparent' }}
            >
              {t === 'top'
                ? <span className="flex items-center gap-1.5"><Flame size={13} />Hay hỏi nhất</span>
                : <span className="flex items-center gap-1.5">
                    <HelpCircle size={13} />AI chưa biết
                    {unansweredTotal > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: '#fef2f2', color: '#b91c1c' }}>{unansweredTotal}</span>
                    )}
                  </span>
              }
            </button>
          ))}
          <span className="ml-auto mr-4 text-xs text-gray-400">
            {tab === 'top' ? `${topQuestions.length} câu` : `${unanswered.length} câu`}
          </span>
        </div>

        {tab === 'top' && (
          <QuestionList items={topQuestions} emptyText="Chưa có dữ liệu — agent sẽ tổng hợp khi Sales bắt đầu hỏi." />
        )}
        {tab === 'unanswered' && (
          <>
            {unansweredTotal > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
                <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-800">
                    AI chưa có thông tin để trả lời {unansweredTotal} câu hỏi này
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Thêm tài liệu liên quan vào Google Drive để cải thiện chất lượng phản hồi.
                  </p>
                </div>
              </div>
            )}
            <QuestionList items={unanswered} emptyText="Không có câu hỏi nào ngoài tầm hiểu biết — tốt lắm!" />
          </>
        )}
      </div>

      {/* ── Response time per member ── */}
      {responseTimes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Thời gian phản hồi theo nhân viên (30 ngày)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Nhân viên</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Role</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Tin nhắn</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Nhóm</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">TB phản hồi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {responseTimes.map(r => {
                  const roleStyle = ROLE_COLOR[r.role] ?? ROLE_COLOR.sales;
                  const isSlowReply = r.avg_response_min !== null && r.avg_response_min > 120;
                  return (
                    <tr key={r.sender_uid} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{r.sender_name}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={roleStyle}>
                          {ROLE_LABEL[r.role] ?? r.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{r.msg_count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{r.group_count}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-semibold ${isSlowReply ? 'text-red-500' : 'text-gray-700'}`}>
                          {formatResponseTime(r.avg_response_min)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {responseTimes.every(r => r.avg_response_min === null) && (
            <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">
              Dữ liệu thời gian phản hồi sẽ tích lũy sau vài ngày agent hoạt động.
            </p>
          )}
        </div>
      )}

      {/* ── Bottom 2 columns ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Group usage */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nhóm dùng AI nhiều</span>
          </div>
          {groupUsage.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Chưa có dữ liệu.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {groupUsage.map(g => (
                <li key={g.group_id} className="flex items-center gap-3 px-4 py-3">
                  <Link
                    href={`/groups/${g.group_id}`}
                    className="text-xs font-medium shrink-0 max-w-[120px] truncate hover:underline"
                    style={{ color: '#018a4e' }}
                  >
                    {g.group_name ?? `···${g.group_id.slice(-8)}`}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{
                        width: `${(g.cnt / (groupUsage[0]?.cnt ?? 1)) * 100}%`,
                        background: '#02AD64',
                      }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 shrink-0">{g.cnt}</span>
                  <span className="text-xs text-gray-400 shrink-0">{g.avg_ms}ms</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Doc usage */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tài liệu được tham chiếu</span>
          </div>
          {docUsage.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Chưa có câu hỏi nào được trả lời từ tài liệu.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {docUsage.map(d => (
                <li key={d.src} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-gray-700 flex-1 truncate" title={d.src}>{d.src}</span>
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{
                        width: `${(d.cnt / (docUsage[0]?.cnt ?? 1)) * 100}%`,
                        background: '#6366f1',
                      }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 shrink-0 w-6 text-right">{d.cnt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function QuestionList({ items, emptyText }: { items: { question: string; cnt: number }[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8 px-4">{emptyText}</p>;
  }
  const maxCnt = items[0]?.cnt ?? 1;
  return (
    <ul className="divide-y divide-gray-50">
      {items.map((item, i) => (
        <li key={i} className="px-4 py-3 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-gray-700 flex-1 leading-snug break-words">{sanitizeQuery(item.question)}</p>
            <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
              style={{ background: '#fff3eb', color: '#FF6900' }}>{item.cnt}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.cnt / maxCnt) * 100}%`, background: '#02AD64' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
