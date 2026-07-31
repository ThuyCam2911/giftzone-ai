'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';
import Pagination from '@/components/ui/Pagination';
import type { InactiveGroup } from '@/lib/queries/group-detail';

const PAGE_SIZE = 10;

export default function InactiveGroupsList({ groups }: { groups: InactiveGroup[] }) {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(groups.length / PAGE_SIZE);
  const paged = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-amber-100 divide-y divide-gray-50">
      {paged.map(g => (
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
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
