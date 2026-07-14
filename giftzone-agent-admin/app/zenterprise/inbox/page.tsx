export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import ZEnterpriseInbox from '@/components/ZEnterpriseInbox';
import { listInboxThreads } from '@/lib/queries/zenterprise-inbox';
import { getDict } from '@/lib/i18n/server';
import { Inbox } from 'lucide-react';

export default async function ZEnterpriseInboxPage() {
  const { t } = await getDict();

  let threads;
  try {
    threads = await listInboxThreads();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">{t('common.dbError')}</p>
            <p className="text-sm mt-2 font-mono break-all">{msg}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-6 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Inbox size={18} className="text-[#02AD64]" />
            {t('ze.inbox.title')}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('ze.inbox.subtitle')}</p>
        </div>
        <div className="px-4 pb-10 md:px-8 pt-6">
          <ZEnterpriseInbox initialThreads={threads} />
        </div>
      </main>
    </div>
  );
}
