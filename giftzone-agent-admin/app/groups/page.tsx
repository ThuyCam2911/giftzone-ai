export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import GroupTypeManager from '@/components/GroupTypeManager';
import GZMemberManager from '@/components/GZMemberManager';
import { query } from '@/lib/db';
import { getInactiveGroups } from '@/lib/queries/group-detail';
import { getDict } from '@/lib/i18n/server';
import { AlertCircle } from 'lucide-react';

interface GroupRow {
  group_id: string;
  name: string;
  group_type: string;
  branch: string | null;
  updated_at: string;
}

interface MemberRow {
  sender_uid: string;
  sender_name: string;
  role?: string;
}

interface CandidateRow extends MemberRow {
  msg_count: number;
}

export default async function GroupsPage() {
  const { t } = await getDict();
  const [groups, savedMembers, candidates, inactiveGroups] = await Promise.all([
    query<GroupRow>(
      `SELECT group_id, name, group_type, branch, updated_at FROM group_names WHERE COALESCE(group_type,'customer') != 'direct' ORDER BY name`,
    ),
    query<MemberRow>(
      `SELECT sender_uid, sender_name, role FROM gz_members ORDER BY sender_name`,
    ),
    query<CandidateRow>(
      `SELECT m.sender_uid, MAX(m.sender_name) AS sender_name, COUNT(*)::int AS msg_count
       FROM messages m
       LEFT JOIN group_names gn ON gn.group_id = m.group_id
       WHERE COALESCE(gn.group_type, 'customer') != 'internal'
         AND m.sender_uid IS NOT NULL AND m.sender_name IS NOT NULL
       GROUP BY m.sender_uid
       ORDER BY msg_count DESC
       LIMIT 50`,
    ),
    getInactiveGroups(3),
  ]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">{t('groups.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('groups.subtitle')}
          </p>
        </div>
        <div className="px-4 pb-8 md:px-8 pt-6 max-w-2xl space-y-8">

          {/* ── Inactive groups alert ── */}
          {inactiveGroups.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" />
                {t('groups.inactiveTitle')} ({inactiveGroups.length})
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                {t('groups.inactiveSub')}
              </p>
              <div className="bg-white rounded-xl border border-amber-100 divide-y divide-gray-50">
                {inactiveGroups.map(g => (
                  <Link
                    key={g.group_id}
                    href={`/groups/${g.group_id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-800">
                      {g.name}
                    </span>
                    <span className="text-xs shrink-0 px-2 py-0.5 rounded-full font-medium"
                      style={g.days_silent >= 7
                        ? { background: '#fef2f2', color: '#b91c1c' }
                        : { background: '#fff7ed', color: '#c2410c' }}>
                      {g.days_silent} {t('groups.daysSilent')}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('groups.classifyTitle')}</h2>
            <GroupTypeManager groups={groups} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">{t('groups.membersTitle')}</h2>
            <p className="text-xs text-gray-400 mb-3">
              {t('groups.membersSub')}
            </p>
            <GZMemberManager saved={savedMembers} candidates={candidates} />
          </section>
        </div>
      </main>
    </div>
  );
}
