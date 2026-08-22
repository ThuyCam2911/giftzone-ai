'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Network, BarChart2, MessageSquare, Users, Settings,
  LogOut, Sparkles, Building2, PieChart, ReceiptText, FileBarChart, Radio,
} from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { DictKey } from '@/lib/i18n/dictionary';

// Shell TỐI dùng chung cho các trang "Master Layer" (demo showoff nhánh
// ai-for-demo) — Dashboard/Hệ thống nghiệp vụ/Report & Insight/Quote Desk —
// theo đúng phong cách trong ảnh mẫu. CỐ Ý không sửa components/Sidebar.tsx
// dùng cho các trang cũ — tránh đổi giao diện của cả app chỉ vì các trang demo.
interface NavItem { href: string; labelKey: DictKey; icon: typeof LayoutDashboard }
interface NavGroup { labelKey: DictKey; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    labelKey: 'sidebar.groupMasterLayer',
    items: [
      { href: '/ops-dashboard', labelKey: 'sidebar.opsDashboard', icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'sidebar.groupMonitor',
    items: [
      { href: '/zenterprise/live',   labelKey: 'sidebar.zenterpriseLive',   icon: Radio },
      { href: '/business-systems',  labelKey: 'sidebar.businessSystems',   icon: Network },
      { href: '/quote-desk',        labelKey: 'sidebar.quoteDesk',         icon: ReceiptText },
    ],
  },
  {
    labelKey: 'sidebar.groupOverview',
    items: [
      { href: '/reports',   labelKey: 'sidebar.reports',   icon: FileBarChart },
      { href: '/analytics', labelKey: 'sidebar.analytics', icon: BarChart2 },
    ],
  },
  {
    labelKey: 'sidebar.groupManage',
    items: [
      { href: '/zenterprise/accounts',  labelKey: 'sidebar.zenterpriseAccounts',  icon: Building2 },
      { href: '/zenterprise/dashboard', labelKey: 'sidebar.zenterpriseDashboard', icon: PieChart },
      { href: '/sales-members',         labelKey: 'sidebar.salesMembers',         icon: Users },
      { href: '/settings',              labelKey: 'sidebar.settings',             icon: Settings },
    ],
  },
];

const INK = '#0d0e13';
const PANEL = '#15161d';
const BORDER = 'rgba(255,255,255,0.07)';
const ACCENT = '#7c5cff';

function DarkSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useLocale();

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen sticky top-0" style={{ background: INK }}>
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, #4f8cff)` }}>G</div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">GiftZone</p>
            <p className="text-[11px] leading-tight" style={{ color: '#7b7f8c' }}>AI Controller · Master Layer</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {(['vi', 'en'] as const).map(l => (
            <button key={l} onClick={() => setLocale(l)}
              className="flex-1 text-[11px] font-semibold py-1 rounded-md uppercase transition-colors"
              style={locale === l ? { background: ACCENT, color: 'white' } : { color: '#7b7f8c' }}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">Nông Dược Đồng Xanh</p>
            <p className="text-[10px] truncate" style={{ color: '#7b7f8c' }}>instance · agri-demo</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navGroups.map(group => (
          <div key={group.labelKey}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#565a66' }}>
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={active
                      ? { background: 'rgba(124,92,255,0.16)', color: 'white' }
                      : { color: '#9096a3' }}>
                    <Icon size={15} strokeWidth={active ? 2.5 : 2} style={active ? { color: ACCENT } : undefined} />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: '#7b7f8c' }}>
          <LogOut size={15} /> {t('common.logout')}
        </button>
      </div>
    </aside>
  );
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'warn' | 'live' | 'outline' }) {
  const styles: Record<string, { bg: string; color: string; border?: string }> = {
    default: { bg: '#f3f4f6', color: '#374151' },
    accent:  { bg: ACCENT, color: 'white' },
    warn:    { bg: '#fef3c7', color: '#b45309' },
    live:    { bg: '#dcfce7', color: '#15803d' },
    outline: { bg: 'white', color: '#4b5563', border: '1px solid #e5e7eb' },
  };
  const s = styles[tone];
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color, border: s.border }}>
      {children}
    </span>
  );
}

export default function MasterLayerShell({
  title, subtitle, pills, children,
}: { title: string; subtitle?: string; pills?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f5f6f8' }}>
      <DarkSidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-400 flex items-center gap-1"><Sparkles size={11} /> Nông Dược Đồng Xanh · GiftZone AI Controller</p>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {pills ?? <Pill tone="live">● Live</Pill>}
          </div>
        </div>
        {subtitle && <p className="px-6 pt-3 text-xs text-gray-400">{subtitle}</p>}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
