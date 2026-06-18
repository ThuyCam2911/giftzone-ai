export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import SettingsForm from '@/components/SettingsForm';
import { query } from '@/lib/db';

interface ConfigRow {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

// Keys luôn hiển thị dù chưa có trong DB (backend chưa restart để seed)
const KNOWN_KEYS: Omit<ConfigRow, 'updated_at'>[] = [
  { key: 'agent_name',      value: 'GiftZone AI',   description: 'Tên hiển thị của AI agent trong Zalo' },
  { key: 'drive_folder_id', value: '',               description: 'Google Drive folder/file ID để index tài liệu' },
  { key: 'summary_cron',    value: '0 18 * * 1-5',  description: 'Cron schedule cho daily summary (mặc định: 18:00 T2-T6)' },
  { key: 'skip_index',      value: 'false',          description: 'Bỏ qua index Drive khi khởi động (true/false)' },
  { key: 'log_level',       value: 'info',           description: 'Mức log: debug / info / warn / error' },
  { key: 'admin_group_id',  value: '',               description: 'Group ID nhận daily alert 8:00 AM (để trống = tắt alert)' },
  { key: 'zalo_cookie',     value: '',               description: 'Zalo cookie JSON — paste từ chat.zalo.me' },
];

export default async function SettingsPage() {
  const rows = await query<ConfigRow>(
    `SELECT key, value, description, updated_at FROM settings ORDER BY key`
  );

  const rowMap = Object.fromEntries(rows.map(r => [r.key, r]));

  // Merge: known keys first (with DB value if exists), then any extra DB keys
  const knownKeys = new Set(KNOWN_KEYS.map(k => k.key));
  const merged: ConfigRow[] = [
    ...KNOWN_KEYS.map(k => rowMap[k.key] ?? { ...k, updated_at: '' }),
    ...rows.filter(r => !knownKeys.has(r.key)),
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Cài đặt</h1>
          <p className="text-xs text-gray-500 mt-0.5">Cấu hình agent — thay đổi có hiệu lực sau khi restart agent.</p>
        </div>
        <div className="px-4 pb-8 md:px-8 pt-6 max-w-2xl">
          <SettingsForm rows={merged} />
        </div>
      </main>
    </div>
  );
}
