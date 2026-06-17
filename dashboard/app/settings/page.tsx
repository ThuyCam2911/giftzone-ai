export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import SettingsForm from '@/components/SettingsForm';
import GroupTypeManager from '@/components/GroupTypeManager';
import { query } from '@/lib/db';

interface ConfigRow {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

interface GroupRow {
  group_id: string;
  name: string;
  group_type: string;
  updated_at: string;
}

export default async function SettingsPage() {
  const [rows, groups] = await Promise.all([
    query<ConfigRow>(`SELECT key, value, description, updated_at FROM settings ORDER BY key`),
    query<GroupRow>(`SELECT group_id, name, group_type, updated_at FROM group_names ORDER BY name`),
  ]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Cài đặt</h1>
          <p className="text-xs text-gray-500 mt-0.5">Cấu hình agent — thay đổi có hiệu lực sau khi restart agent.</p>
        </div>
        <div className="px-4 pb-8 md:px-8 pt-6 max-w-2xl space-y-8">
          <SettingsForm rows={rows} />

          {/* ── Phân loại nhóm ── */}
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Phân loại nhóm</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Đánh dấu nhóm nội bộ để AI bỏ qua khi phân tích chất lượng hội thoại.
                Nhóm chưa xuất hiện ở đây sẽ tự thêm khi agent nhận tin nhắn lần đầu.
              </p>
            </div>
            <GroupTypeManager groups={groups} />
          </div>
        </div>
      </main>
    </div>
  );
}
