'use client';

import { useState } from 'react';
import WeekChart from './WeekChart';

interface Props {
  topQuestions: { question: string; cnt: number }[];
  groupUsage: { group_id: string; cnt: number; avg_ms: number }[];
  docUsage: { src: string; cnt: number }[];
  latency: { p50: number; p95: number; maxMs: number; total: number };
  days7: { label: string; count: number }[];
  unanswered: { question: string; cnt: number }[];
}

function sanitizeQuery(q: string) {
  if (q.startsWith('{') || q.startsWith('[')) return '[Sticker / file đính kèm]';
  return q.length > 100 ? q.slice(0, 100) + '…' : q;
}

export default function AnalyticsPage({ topQuestions, groupUsage, docUsage, latency, days7, unanswered }: Props) {
  const [tab, setTab] = useState<'top' | 'unanswered'>('top');

  const totalWeek = days7.reduce((s, d) => s + d.count, 0);
  const uniqueDocs = docUsage.length;

  return (
    <>
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Câu hỏi / 7 ngày', value: totalWeek,         icon: '💬', color: '#02AD64' },
          { label: 'Latency p50',       value: `${latency.p50}ms`, icon: '⚡', color: '#6366f1' },
          { label: 'Latency p95',       value: `${latency.p95}ms`, icon: '📈', color: '#FF6900' },
          { label: 'Tài liệu được dùng', value: uniqueDocs,       icon: '📄', color: '#0ea5e9' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
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
              {t === 'top' ? '🔥 Hay hỏi nhất' : '❓ AI chưa biết'}
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
          <QuestionList items={unanswered} emptyText="Không có câu hỏi nào ngoài tầm hiểu biết — tốt lắm!" />
        )}
      </div>

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
                  <span className="font-mono text-xs text-gray-400 shrink-0">···{g.group_id.slice(-8)}</span>
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
