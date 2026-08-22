'use client';

import { useState } from 'react';
import { KpiCard, ListCard, InsightBox, type KpiData, type ListData, type InsightData } from '@/components/masterlayer/ui';

interface TabData { key: string; label: string; kpis: KpiData[]; lists: ListData[]; insight?: InsightData }

export default function BusinessSystemsTabs({ tabs }: { tabs: TabData[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find(t => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="flex items-center gap-6 border-b border-gray-200 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="pb-3 text-sm font-semibold relative"
            style={{ color: active === t.key ? '#111827' : '#9ca3af' }}
          >
            {t.label}
            {active === t.key && <span className="absolute left-0 right-0 -bottom-px h-0.5" style={{ background: '#7c5cff' }} />}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {current.kpis.map((k, i) => <KpiCard key={i} data={k} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {current.lists.map((l, i) => <ListCard key={i} data={l} />)}
          </div>
          {current.insight && <InsightBox data={current.insight} />}
        </div>
      )}
    </div>
  );
}
