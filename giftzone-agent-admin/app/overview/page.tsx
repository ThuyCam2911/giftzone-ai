export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import SessionAlert from '@/components/SessionAlert';
import DateRangeFilter from '@/components/DateRangeFilter';
import { StatsCard, WeekChart } from '@/components/ui';
import { getOverviewData } from '@/lib/queries/overview';
import { timeAgo, defaultDateRange } from '@/lib/utils';
import { Users, MessageSquare, Bot, FileText } from 'lucide-react';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params   = await searchParams;
  const defaults = defaultDateRange(6);
  const from     = params.from ?? defaults.from;
  const to       = params.to   ?? defaults.to;

  let data;
  try {
    data = await getOverviewData(from, to);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">Không kết nối được database.</p>
            <p className="text-sm mt-2 font-mono break-all">{msg}</p>
          </div>
        </main>
      </div>
    );
  }

  const periodLabel = from === to ? 'hôm nay' : `${from} → ${to}`;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <div className="max-w-5xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Tổng quan</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                ● <span style={{ color: '#02AD64', fontWeight: 600 }}>{data.agentName}</span>
                {' '}· {periodLabel}
              </p>
            </div>
            <Suspense>
              <DateRangeFilter from={from} to={to} />
            </Suspense>
          </div>
        </div>

        <div className="px-4 pb-8 md:px-8 pt-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <SessionAlert status={data.sessionStatus} />

            {data.analyzerStatus === 'degraded' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
                ⚠️ <span className="font-medium">Deal Analyzer đang degraded</span> — toàn bộ
                model chain OpenRouter bị rate limit. Issue mới sẽ không được phát hiện cho đến
                khi quota hồi phục.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatsCard label="Nhóm có hội thoại" value={data.totalGroups}  icon={Users}         accent="green" />
              <StatsCard label="Tin nhắn ghi nhận"  value={data.messages}    icon={MessageSquare}  accent="blue" />
              <StatsCard
                label="Câu hỏi AI xử lý"
                value={data.aiQueries}
                sub={data.avgLatencyMs ? `Avg ${(data.avgLatencyMs / 1000).toFixed(1)}s` : undefined}
                icon={Bot} accent="orange"
              />
              <StatsCard
                label="Tài liệu đã học"
                value={data.docChunks}
                sub={data.lastIndexedAt ? `Cập nhật ${timeAgo(data.lastIndexedAt)}` : undefined}
                icon={FileText} accent="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 min-w-0">
                <WeekChart days={data.daysChart} />
              </div>
              <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Tình trạng agent</p>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>Kết nối Zalo</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0" style={
                      data.sessionStatus === 'ok'      ? { background: '#e6f9f1', color: '#018a4e' }
                      : data.sessionStatus === 'warning' ? { background: '#fffbeb', color: '#92400e' }
                      : data.sessionStatus === 'expired' ? { background: '#fef2f2', color: '#991b1b' }
                      : { background: '#f3f4f6', color: '#6b7280' }
                    }>
                      <span className={data.sessionStatus === 'ok' ? 'pulse-green' : ''}>●</span>
                      {data.sessionStatus === 'ok'      ? 'Đang kết nối'
                        : data.sessionStatus === 'warning' ? 'Cần kiểm tra'
                        : data.sessionStatus === 'expired' ? 'Mất kết nối'
                        : 'Chưa xác định'}
                    </span>
                  </li>
                  <li className="flex justify-between items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>Hoạt động lần cuối</span>
                    <span className="text-xs font-medium text-right" style={{ color: '#374151' }}>{timeAgo(data.sessionLastSeen)}</span>
                  </li>
                  <li className="flex justify-between items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>Cơ sở dữ liệu</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0"
                      style={{ background: '#e6f9f1', color: '#018a4e' }}>
                      <span className="pulse-green">●</span> Đang kết nối
                    </span>
                  </li>
                  <li className="flex justify-between items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>Tài liệu đã học</span>
                    <span className="text-xs font-medium" style={{ color: '#374151' }}>{data.docChunks} đoạn</span>
                  </li>
                  <li className="flex justify-between items-center gap-2">
                    <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>Lần học gần nhất</span>
                    <span className="text-xs font-medium" style={{ color: '#374151' }}>{timeAgo(data.lastIndexedAt)}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 min-w-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Sales hay hỏi gì?</p>
                <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>Top 5 trong kỳ đã chọn</p>
                {data.topQuestions.length === 0
                  ? <p className="text-xs" style={{ color: '#9ca3af' }}>Chưa có câu hỏi nào trong kỳ này.</p>
                  : (
                    <ul className="space-y-3">
                      {data.topQuestions.map((q, i) => {
                        const max = Number(data.topQuestions[0]?.count ?? 1);
                        const label = q.question.startsWith('{') || q.question.startsWith('[')
                          ? '[Sticker / file đính kèm]'
                          : q.question.slice(0, 80);
                        return (
                          <li key={i} className="space-y-1">
                            <div className="flex justify-between gap-2">
                              <p className="text-xs flex-1 leading-snug break-words" style={{ color: '#374151' }}>{label}</p>
                              <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                                style={{ background: '#fff3eb', color: '#FF6900' }}>{q.count}</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: '#f3f4f6' }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(Number(q.count) / max) * 100}%`, background: '#02AD64' }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>

              <div className="bg-white rounded-2xl p-5 min-w-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Câu hỏi gần nhất</p>
                <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>5 câu gần nhất trong kỳ</p>
                {data.recentQueries.length === 0
                  ? <p className="text-xs" style={{ color: '#9ca3af' }}>Chưa có câu hỏi nào.</p>
                  : (
                    <ul className="space-y-0">
                      {data.recentQueries.map((r, i) => (
                        <li key={i} className="py-2.5 flex gap-3 items-start"
                          style={{ borderBottom: i < data.recentQueries.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <span className="text-[10px] shrink-0 mt-0.5 font-medium" style={{ color: '#02AD64' }}>
                            {new Date(r.created_at).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric',
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })}
                          </span>
                          <p className="text-xs flex-1 leading-snug min-w-0 break-words line-clamp-2" style={{ color: '#374151' }}>
                            {r.query.startsWith('{') || r.query.startsWith('[')
                              ? '[Sticker / file đính kèm]'
                              : r.query.slice(0, 120)}
                          </p>
                          <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded font-medium"
                            style={{ background: '#f3f4f6', color: '#6b7280' }}>
                            {(r.latency_ms / 1000).toFixed(1)}s
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
