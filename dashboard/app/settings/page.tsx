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

export default async function SettingsPage() {
  const rows = await query<ConfigRow>(
    `SELECT key, value, description, updated_at FROM settings ORDER BY key`
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Cài đặt</h1>
          <p className="text-xs text-gray-500 mt-0.5">Cấu hình agent — thay đổi có hiệu lực sau khi restart agent.</p>
        </div>
        <div className="px-4 pb-8 md:px-8 pt-6 max-w-2xl">
          <SettingsForm rows={rows} />
        </div>
      </main>
    </div>
  );
}
