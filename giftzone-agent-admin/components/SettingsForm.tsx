'use client';
import { useState } from 'react';

interface ConfigRow {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

// Keys chỉ agent ghi, không cho user edit
const READ_ONLY_KEYS = ['session_status', 'session_last_seen'];

// Keys dùng textarea (nội dung dài)
const TEXTAREA_KEYS = ['zalo_cookie'];

export default function SettingsForm({ rows }: { rows: ConfigRow[] }) {
  const editableRows = rows.filter(r => !READ_ONLY_KEYS.includes(r.key));

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(editableRows.map(r => [r.key, r.value]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved]   = useState<string | null>(null);

  async function save(key: string) {
    setSaving(key);
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: values[key] }),
    });
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {editableRows.map(row => (
        <div key={row.key} className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium text-gray-900 font-mono">{row.key}</label>
              {row.description && (
                <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>
              )}
              {TEXTAREA_KEYS.includes(row.key) ? (
                <textarea
                  rows={4}
                  placeholder='Paste JSON cookie array từ chat.zalo.me → F12 → Application → Cookies → Copy all as JSON'
                  value={values[row.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [row.key]: e.target.value }))}
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={values[row.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [row.key]: e.target.value }))}
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
            <button
              onClick={() => save(row.key)}
              disabled={saving === row.key}
              className="mt-7 shrink-0 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {saving === row.key ? 'Lưu...' : saved === row.key ? 'Đã lưu ✓' : 'Lưu'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
