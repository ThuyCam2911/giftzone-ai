'use client';
import { useState } from 'react';

interface DayData { label: string; count: number }

export default function WeekChart({ days }: { days: DayData[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Hội thoại AI — 7 ngày qua</p>
      <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>Số câu hỏi được xử lý mỗi ngày</p>

      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {days.map((d, i) => {
          const isToday   = i === days.length - 1;
          const isHovered = hovered === i;
          const barColor  = isToday ? '#FF6900' : '#02AD64';
          const barH      = d.count === 0 ? 2 : Math.max(8, (d.count / max) * 80);

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 cursor-default"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              <div style={{
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isHovered && d.count > 0 && (
                  <div className="text-white text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: barColor, whiteSpace: 'nowrap' }}>
                    {d.count} câu hỏi
                  </div>
                )}
                {!isHovered && (
                  <span className="text-[10px]" style={{ color: '#9ca3af' }}>
                    {d.count > 0 ? d.count : ''}
                  </span>
                )}
              </div>

              {/* Bar */}
              <div className="w-full flex items-end rounded-t overflow-hidden" style={{ height: 80 }}>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${barH}px`,
                    background: isHovered
                      ? (isToday ? '#e55a00' : '#019e5a')
                      : barColor,
                    opacity: d.count === 0 ? 0.15 : 1,
                    transition: 'height 0.4s ease, background 0.15s ease',
                  }}
                />
              </div>

              {/* Label */}
              <span className="text-[10px]" style={{
                color: isToday ? '#FF6900' : isHovered ? '#374151' : '#9ca3af',
                fontWeight: isToday || isHovered ? 600 : 400,
                transition: 'color 0.15s',
              }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#02AD64' }} />
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>Các ngày</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FF6900' }} />
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>Hôm nay</span>
        </div>
      </div>
    </div>
  );
}
