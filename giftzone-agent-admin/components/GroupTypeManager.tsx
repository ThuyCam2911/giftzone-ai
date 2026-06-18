'use client';
import { useState } from 'react';

interface GroupRow {
  group_id: string;
  name: string;
  group_type: string;
  updated_at: string;
}

const TYPE_CONFIG = {
  customer: { label: 'Khách hàng', bg: '#f0fdf4', color: '#166534', desc: 'Nhóm tư vấn khách — AI phân tích chất lượng' },
  internal: { label: 'Nội bộ',     bg: '#eff6ff', color: '#1d4ed8', desc: 'Nhóm nội bộ — bỏ qua khi phân tích' },
  unknown:  { label: 'Chưa phân loại', bg: '#f9fafb', color: '#6b7280', desc: '' },
};

export default function GroupTypeManager({ groups: initial }: { groups: GroupRow[] }) {
  const [groups, setGroups] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function setType(groupId: string, type: string) {
    setSaving(groupId);
    await fetch('/api/groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, group_type: type }),
    });
    setGroups(gs => gs.map(g => g.group_id === groupId ? { ...g, group_type: type } : g));
    setSaving(null);
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-4">
        Chưa có nhóm nào — sẽ tự động xuất hiện sau khi agent nhận tin nhắn từ các nhóm.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {groups.map(g => {
        const cfg = TYPE_CONFIG[g.group_type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.unknown;
        return (
          <div key={g.group_id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{g.name}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">···{g.group_id.slice(-10)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(['customer', 'internal', 'unknown'] as const).map(t => {
                const c = TYPE_CONFIG[t];
                const active = g.group_type === t;
                return (
                  <button
                    key={t}
                    onClick={() => !active && setType(g.group_id, t)}
                    disabled={saving === g.group_id}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50"
                    style={active
                      ? { background: c.bg, color: c.color, borderColor: c.color }
                      : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }}
                  >
                    {saving === g.group_id && active ? '...' : c.label}
                  </button>
                );
              })}
            </div>
            <div className="w-full">
              <p className="text-xs" style={{ color: cfg.color }}>{cfg.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
