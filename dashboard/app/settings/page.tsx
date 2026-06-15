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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Cài đặt</h1>
            <p className="text-sm text-gray-500 mt-0.5">Cấu hình agent — thay đổi có hiệu lực sau khi restart agent.</p>
          </div>
          <SettingsForm rows={rows} />
        </div>
      </main>
    </div>
  );
}
