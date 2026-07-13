'use client';

import { useLocale } from '@/components/LocaleProvider';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className={`flex items-center gap-1 bg-white/10 rounded-lg p-0.5 ${compact ? '' : 'w-full'}`}>
      {(['vi', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`flex-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors uppercase ${compact ? 'px-2' : ''}`}
          style={
            locale === l
              ? { background: 'white', color: '#018a4e' }
              : { color: 'rgba(255,255,255,0.7)' }
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
