import Sidebar from '@/components/Sidebar';
import LiveChat from '@/components/LiveChat';
import { getDict } from '@/lib/i18n/server';
import { Sparkles } from 'lucide-react';

export default async function ZEnterpriseLivePage() {
  const { t } = await getDict();
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-6 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-[#02AD64]" />
            {t('ze.live.title')}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('ze.live.subtitle')}</p>
        </div>
        <div className="px-4 pb-10 md:px-8 pt-6">
          <LiveChat />
        </div>
      </main>
    </div>
  );
}
