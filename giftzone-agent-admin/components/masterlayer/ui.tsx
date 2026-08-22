import { Bot, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

// Bộ UI dùng chung cho các trang Master Layer demo (Dashboard/Hệ thống nghiệp
// vụ/Report & Insight) — theo đúng ngôn ngữ thị giác trong ảnh mẫu: card
// trắng bo góc, label uppercase, số lớn, delta có mũi tên màu, dòng nguồn
// dạng monospace xám nhạt.

export interface KpiData {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'good' | 'bad' | 'neutral';
  source: string;
}

export function KpiCard({ data }: { data: KpiData }) {
  const toneColor = data.deltaTone === 'bad' ? '#dc2626' : data.deltaTone === 'neutral' ? '#6b7280' : '#16a34a';
  const Icon = data.deltaTone === 'bad' ? TrendingDown : data.deltaTone === 'neutral' ? Minus : TrendingUp;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{data.label}</p>
      <p className="text-[26px] font-bold text-gray-900 mt-1 leading-none">
        {data.value}{data.unit && <span className="text-sm font-medium text-gray-400 ml-1">{data.unit}</span>}
      </p>
      {data.delta && (
        <p className="flex items-center gap-1 text-xs font-medium mt-1.5" style={{ color: toneColor }}>
          <Icon size={12} /> {data.delta}
        </p>
      )}
      <p className="text-[10px] font-mono text-gray-300 mt-2 pt-2 border-t border-gray-50">{data.source}</p>
    </div>
  );
}

export interface AlertData { title: string; description: string; tone?: 'warn' | 'danger' }

export function AlertCard({ data }: { data: AlertData }) {
  const tone = data.tone === 'danger'
    ? { border: '#fecaca', bg: '#fef2f2', title: '#991b1b' }
    : { border: '#fde68a', bg: '#fffbeb', title: '#92400e' };
  return (
    <div className="rounded-2xl p-4" style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
      <p className="text-sm font-semibold" style={{ color: tone.title }}>{data.title}</p>
      <p className="text-xs text-gray-500 mt-1">{data.description}</p>
    </div>
  );
}

export interface InsightData { title?: string; body: string; source: string; ctaLabel?: string }

export function InsightBox({ data }: { data: InsightData }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
      <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#7c3aed' }}>
        <span className="w-4 h-4 rounded flex items-center justify-center" style={{ background: '#7c3aed' }}>
          <Bot size={10} color="white" />
        </span>
        {data.title ?? 'AI Insight'}
      </div>
      <p className="text-sm text-gray-800 mt-2 leading-relaxed">{data.body}</p>
      <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid #ece9fe' }}>
        <p className="text-[10px] font-mono" style={{ color: '#a4a0b8' }}>{data.source}</p>
        {data.ctaLabel && (
          <button className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white shrink-0" style={{ background: '#7c3aed' }}>
            {data.ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export interface ActivityData { actor: string; title: string; description: string; meta: string }

export function ActivityFeed({ items, title }: { items: ActivityData[]; title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-3">{title}</p>
      <div className="space-y-3">
        {items.map((a, i) => (
          <div key={i} className="flex items-start gap-2 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#f5f3ff' }}>
              <Sparkles size={10} color="#7c3aed" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800">
                {a.title} <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#f5f3ff', color: '#7c3aed' }}>{a.actor}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">{a.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ListData { title: string; subtitle?: string; items: { label: string; value: string; sub?: string }[] }

export function ListCard({ data }: { data: ListData }) {
  const isProgress = data.items.every(it => /^\d+%$/.test(it.value));
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">{data.title}</p>
        {data.subtitle && <p className="text-[10px] text-gray-300">{data.subtitle}</p>}
      </div>
      <div className="space-y-3">
        {data.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-700">{it.label}</p>
              {it.sub && <p className="text-[10px] text-gray-300">{it.sub}</p>}
            </div>
            {isProgress ? (
              <div className="flex items-center gap-2 w-40 shrink-0">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: it.value, background: '#f59e0b' }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-9 text-right">{it.value}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-gray-900 shrink-0">{it.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ChartData { title: string; subtitle?: string; unitLabel: string; categories: string[]; values: number[] }

export function BarChartCard({ data }: { data: ChartData }) {
  const max = Math.max(...data.values, 1);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-800">{data.title}</p>
        {data.subtitle && <p className="text-[10px] text-gray-300">{data.subtitle}</p>}
      </div>
      <p className="text-[11px] text-gray-400 mb-4">{data.unitLabel}</p>
      <div className="flex items-end gap-3 h-32">
        {data.values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-xs font-semibold text-gray-600 mb-1">{v}</span>
            <div className="w-full rounded-t-md" style={{ height: `${(v / max) * 100}%`, background: '#fde68a', minHeight: 4 }} />
            <span className="text-[10px] text-gray-400 mt-2">{data.categories[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ReportCardData {
  badge: string;
  title: string;
  tags: string[];
  insightBody: string;
  source: string;
  actions: string[];
}

export function ReportCard({ data }: { data: ReportCardData }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: '#ede9fe', color: '#6d28d9' }}>{data.badge}</span>
          <p className="text-sm font-bold text-gray-900">{data.title}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {data.tags.map((tg, i) => (
            <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">{tg}</span>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <InsightBox data={{ body: data.insightBody, source: data.source }} />
      </div>
      <div className="flex items-center gap-4 flex-wrap mt-3 text-xs font-medium" style={{ color: '#4f46e5' }}>
        {data.actions.map((a, i) => <span key={i} className="cursor-default">{a}</span>)}
      </div>
    </div>
  );
}

export function SectionCard({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}
