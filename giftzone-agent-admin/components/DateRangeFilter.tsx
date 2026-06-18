'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  from: string;
  to: string;
}

export default function DateRangeFilter({ from: initFrom, to: initTo }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);

  function apply() {
    const p = new URLSearchParams(searchParams.toString());
    p.set('from', from);
    p.set('to', to);
    startTransition(() => router.push(`?${p.toString()}`));
  }

  const presets = [
    { label: 'Hôm nay', days: 0 },
    { label: '7 ngày', days: 7 },
    { label: '30 ngày', days: 30 },
  ];

  function applyPreset(days: number) {
    const toDate = new Date();
    const fromDate = new Date();
    if (days > 0) fromDate.setDate(fromDate.getDate() - (days - 1));
    const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const f = fmt(fromDate);
    const t = fmt(toDate);
    setFrom(f);
    setTo(t);
    const p = new URLSearchParams(searchParams.toString());
    p.set('from', f);
    p.set('to', t);
    startTransition(() => router.push(`?${p.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        {presets.map(pr => (
          <button
            key={pr.label}
            onClick={() => applyPreset(pr.days)}
            className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            style={
              (pr.days === 0 && from === to) || (pr.days === 7 && (() => {
                const d = new Date(); d.setDate(d.getDate() - 6);
                return from === d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
              })()) || (pr.days === 30 && (() => {
                const d = new Date(); d.setDate(d.getDate() - 29);
                return from === d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
              })())
                ? { background: 'white', color: '#02AD64', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#6b7280' }
            }
          >
            {pr.label}
          </button>
        ))}
      </div>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
      <span className="text-gray-400 text-xs">—</span>
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
      <button onClick={apply}
        className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
        style={{ background: '#02AD64' }}>
        Lọc
      </button>
    </div>
  );
}
