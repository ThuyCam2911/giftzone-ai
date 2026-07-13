'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Star,
  BarChart2,
  MessageSquare,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  Building2,
  PieChart,
} from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { DictKey } from '@/lib/i18n/dictionary';

interface NavItem { href: string; labelKey: DictKey; icon: typeof LayoutDashboard }
interface NavGroup { labelKey: DictKey; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    labelKey: 'sidebar.groupZenterprise',
    items: [
      { href: '/zenterprise/accounts',  labelKey: 'sidebar.zenterpriseAccounts',  icon: Building2 },
      { href: '/zenterprise/live',      labelKey: 'sidebar.zenterpriseLive',      icon: Sparkles },
      { href: '/zenterprise/dashboard', labelKey: 'sidebar.zenterpriseDashboard', icon: PieChart },
    ],
  },
  {
    labelKey: 'sidebar.groupOverview',
    items: [
      { href: '/overview',  labelKey: 'sidebar.overview',  icon: LayoutDashboard },
      { href: '/analytics', labelKey: 'sidebar.analytics', icon: BarChart2 },
    ],
  },
  {
    labelKey: 'sidebar.groupMonitor',
    items: [
      { href: '/deals', labelKey: 'sidebar.deals', icon: Star },
      { href: '/logs',  labelKey: 'sidebar.logs',  icon: MessageSquare },
    ],
  },
  {
    labelKey: 'sidebar.groupManage',
    items: [
      { href: '/sales-members',  labelKey: 'sidebar.salesMembers',  icon: Users },
      { href: '/knowledge-base', labelKey: 'sidebar.knowledgeBase', icon: BookOpen },
      { href: '/groups',         labelKey: 'sidebar.groups',        icon: Users },
      { href: '/settings',       labelKey: 'sidebar.settings',      icon: Settings },
    ],
  },
];

function NavItems({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  const { t } = useLocale();
  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
      {navGroups.map(group => (
        <div key={group.labelKey}>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {t(group.labelKey)}
          </p>
          <div className="space-y-0.5">
            {group.items.map(item => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={
                    active
                      ? { background: '#e6f9f1', color: '#018a4e', borderLeft: '3px solid #02AD64', paddingLeft: '9px' }
                      : { color: '#6b7280', borderLeft: '3px solid transparent', paddingLeft: '9px' }
                  }
                >
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Logo() {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.95)' }}>
        <Image src="/logo.png" alt="GiftZone" width={28} height={28} className="object-contain" />
      </div>
      <div>
        <p className="font-bold text-white text-sm leading-tight">{t('sidebar.appName')}</p>
        <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('sidebar.appSubtitle')}</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded overflow-hidden">
            <Image src="/logo.png" alt="GiftZone" width={28} height={28} className="object-contain" />
          </div>
          <span className="font-bold text-sm text-gray-800">{t('sidebar.appName')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <LanguageSwitcherLight />
            </div>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setOpen(false)} />
      )}

      {/* ── Mobile drawer ── */}
      <div className={`md:hidden fixed top-14 left-0 bottom-0 z-20 w-56 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavItems pathname={pathname} onClose={() => setOpen(false)} />
        <div className="px-3 py-4 border-t border-gray-100 shrink-0">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <LogOut size={16} /> {t('common.logout')}
          </button>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col sticky top-0 h-screen bg-white border-r border-gray-200">
        <div className="px-5 py-6 shrink-0 space-y-3"
          style={{ background: 'linear-gradient(135deg, #02AD64 0%, #018a4e 100%)' }}>
          <Logo />
          <LanguageSwitcher />
        </div>

        <NavItems pathname={pathname} />

        <div className="px-3 py-4 shrink-0 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut size={16} /> {t('common.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}

// Compact VI/EN toggle for the mobile top bar (light background variant)
function LanguageSwitcherLight() {
  const { locale, setLocale } = useLocale();
  return (
    <>
      {(['vi', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className="text-[11px] font-semibold px-2 py-1 rounded-md transition-colors uppercase"
          style={locale === l ? { background: 'white', color: '#018a4e', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: '#9ca3af' }}
        >
          {l}
        </button>
      ))}
    </>
  );
}
