export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import DealsPage from '@/components/DealsPage';
import { getDealsData, ISSUE_LABELS } from '@/lib/queries/deals';
import { defaultDateRange } from '@/lib/utils';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params   = await searchParams;
  const defaults = defaultDateRange(30);
  const from = params.from ?? defaults.from;
  const to   = params.to   ?? defaults.to;

  const data = await getDealsData(from, to);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <Suspense>
          <DealsPage {...data} dateFrom={from} dateTo={to} issueLabels={ISSUE_LABELS} />
        </Suspense>
      </main>
    </div>
  );
}
