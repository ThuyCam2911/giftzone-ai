export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import GroupTypeManager from '@/components/GroupTypeManager';
import { query } from '@/lib/db';

interface GroupRow {
  group_id: string;
  name: string;
  group_type: string;
  updated_at: string;
}

export default async function GroupsPage() {
  const groups = await query<GroupRow>(
    `SELECT group_id, name, group_type, updated_at FROM group_names ORDER BY name`
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Quản lý nhóm</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Phân loại nhóm Zalo — nhóm nội bộ sẽ bị bỏ qua khi phân tích chất lượng hội thoại.
          </p>
        </div>
        <div className="px-4 pb-8 md:px-8 pt-6 max-w-2xl">
          <GroupTypeManager groups={groups} />
        </div>
      </main>
    </div>
  );
}
