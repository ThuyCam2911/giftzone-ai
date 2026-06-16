'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STAGES = ['Mới', 'Tư vấn', 'Thương lượng', 'Chờ chốt', 'Đã chốt', 'Thất bại'];

const STAGE_DOT: Record<string, string> = {
  'Mới': '#38bdf8', 'Tư vấn': '#4ade80', 'Thương lượng': '#fbbf24',
  'Chờ chốt': '#f59e0b', 'Đã chốt': '#02AD64', 'Thất bại': '#f87171',
};

interface GroupStat {
  group_id: string;
  total_deals: number;
  active_deals: number;
  closed_deals: number;
  avg_confidence: number;
  top_stage: string;
  new_deals: number;
}

interface DealEvent {
  customer_name: string | null;
  from_stage: string | null;
  to_stage: string;
  evidence: string | null;
  detected_at: string;
}

interface Props {
  stats: { total: number; active: number; closed: number; winRate: number | null; avgConf: number };
  groupStats: GroupStat[];
  events: DealEvent[];
  aiInsight: string | null;
  dateFrom: string;
  dateTo: string;
}

function formatShortDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
}

function ConfDot({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#02AD64' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return <span style={{ color }} className="font-semibold">{pct}</span>;
}

export default function DealsPage({ stats, groupStats, events, aiInsight, dateFrom, dateTo }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);

  function applyFilter() {
    const p = new URLSearchParams(searchParams.toString());
    p.set('from', from);
    p.set('to', to);
    startTransition(() => router.push(`/deals?${p.toString()}`));
  }

  const STAGE_COLOR_TEXT: Record<string, string> = {
    'Mới': '#0369a1', 'Tư vấn': '#15803d', 'Thương lượng': '#b45309',
    'Chờ chốt': '#92400e', 'Đã chốt': '#166534', 'Thất bại': '#991b1b',
  };
  const STAGE_BG: Record<string, string> = {
    'Mới': '#f0f9ff', 'Tư vấn': '#f0fdf4', 'Thương lượng': '#fffbeb',
    'Chờ chốt': '#fef3c7', 'Đã chốt': '#dcfce7', 'Thất bại': '#fef2f2',
  };

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Deal Intelligence — Hoạt động & Chuyển đổi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tự động phân tích hội thoại Zalo · cập nhật mỗi 15 phút
          </p>
        </div>
        {/* Date range picker */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#02AD64' } as React.CSSProperties}
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2"
          />
          <button
            onClick={applyFilter}
            className="text-sm font-medium px-4 py-1.5 rounded-lg text-white"
            style={{ background: '#02AD64' }}
          >
            Lọc
          </button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="mb-6 px-4 py-2.5 rounded-lg border border-blue-100 bg-blue-50 text-sm text-blue-700">
        <span className="font-medium">Chỉ hiển thị thống kê.</span>{' '}
        Dữ liệu lấy từ{' '}
        <span className="font-semibold">Deal Intelligence Engine</span>{' '}
        (phân tích mỗi 15 phút). Dashboard không lắng nghe hội thoại trực tiếp — chỉ đọc kết quả đã tổng hợp.
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng deals phát hiện', value: stats.total, icon: '📋', color: '#6366f1', src: 'deals table' },
          { label: 'Đang active', value: stats.active, icon: '🔥', color: '#FF6900', src: 'deals table' },
          { label: 'Đã chốt', value: stats.closed, icon: '✅', color: '#02AD64', src: 'deals table' },
          {
            label: 'Confidence TB',
            value: stats.avgConf > 0 ? `${Math.round(stats.avgConf * 100)}` : '—',
            suffix: stats.avgConf > 0 ? '/100' : '',
            icon: '🎯',
            color: '#f59e0b',
            src: 'deal analyzer',
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">
                {card.label}
              </span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
              {'suffix' in card && <span className="text-sm font-normal text-gray-400">{card.suffix}</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">src · {card.src}</p>
          </div>
        ))}
      </div>

      {/* ── Table by group ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Hoạt động theo nhóm Zalo</h2>
          <span className="text-xs text-gray-400">nguồn: deal intelligence engine</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {groupStats.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm text-gray-500 font-medium">Chưa có deal nào trong khoảng thời gian này</p>
              <p className="text-xs text-gray-400 mt-1">Agent sẽ phân tích tự động mỗi 15 phút</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">NHÓM / GROUP ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">TỔNG DEALS</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">STAGE PHỔ BIẾN</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">CONFIDENCE TB</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ĐÃ CHỐT</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">CẢNH BÁO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupStats.map(g => {
                  const lowConf = g.avg_confidence < 0.6;
                  const stalled = g.active_deals > 3 && g.closed_deals === 0;
                  return (
                    <tr key={g.group_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <span className="font-mono text-xs text-gray-400">···</span>
                        {g.group_id.slice(-8)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{g.total_deals}</td>
                      <td className="px-4 py-3">
                        {g.top_stage ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{
                              background: STAGE_BG[g.top_stage] ?? '#f9fafb',
                              color: STAGE_COLOR_TEXT[g.top_stage] ?? '#374151',
                            }}>
                            <span className="w-1.5 h-1.5 rounded-full"
                              style={{ background: STAGE_DOT[g.top_stage] ?? '#9ca3af' }} />
                            {g.top_stage}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ConfDot value={g.avg_confidence} />
                        <span className="text-gray-400 text-xs">/100</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{g.closed_deals}</td>
                      <td className="px-4 py-3">
                        {lowConf ? (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: '#fef3c7', color: '#b45309' }}>
                            confidence thấp
                          </span>
                        ) : stalled ? (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: '#fef2f2', color: '#b91c1c' }}>
                            nhiều deal tồn đọng
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Bottom: AI Insight + Activity ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* AI Insight */}
        <div className="rounded-xl border border-indigo-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-100"
            style={{ background: 'linear-gradient(135deg, #6366f108, #8b5cf608)' }}>
            <span className="text-indigo-500 text-xs font-semibold tracking-wide">✦ AI INSIGHT</span>
          </div>
          <div className="p-4 bg-white">
            {aiInsight ? (
              <>
                <p className="text-sm text-gray-700 leading-relaxed">{aiInsight}</p>
                <p className="text-xs text-gray-400 mt-3">Sinh bởi AI · dữ liệu: deal_intelligence</p>
              </>
            ) : groupStats.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Chưa có đủ dữ liệu để tổng hợp insight.</p>
            ) : (
              <p className="text-sm text-gray-400 italic">
                Insight sẽ được tạo tự động sau khi có đủ dữ liệu deals.
              </p>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Hoạt động gần đây</span>
            <span className="text-xs text-gray-400">{events.length} sự kiện</span>
          </div>
          <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có sự kiện</p>
            ) : events.map((ev, i) => {
              const dot = STAGE_DOT[ev.to_stage] ?? '#9ca3af';
              const isNew = ev.from_stage === null;
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-2 h-2 rounded-full mt-1" style={{ background: dot }} />
                    {i < events.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                  </div>
                  <div className="pb-2 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {ev.customer_name ?? 'Khách hàng'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isNew ? (
                        <>Deal mới · <span style={{ color: dot }}>{ev.to_stage}</span></>
                      ) : (
                        <><span className="line-through text-gray-300">{ev.from_stage}</span>{' → '}
                          <span style={{ color: dot }}>{ev.to_stage}</span></>
                      )}
                    </p>
                    {ev.evidence && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ev.evidence}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-0.5">
                      {new Date(ev.detected_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })}
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
