'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const nav = [
  { href: '/overview',       label: 'Tổng quan',      icon: '📊' },
  { href: '/deals',          label: 'Deals',           icon: '🎯' },
  { href: '/logs',           label: 'AI Logs',         icon: '💬' },
  { href: '/knowledge-base', label: 'Knowledge Base',  icon: '📚' },
  { href: '/settings',       label: 'Cài đặt',         icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col min-h-screen"
      style={{ background: '#fff', borderRight: '1px solid #e5e7eb' }}>

      {/* Logo area */}
      <div className="px-5 py-6" style={{
        background: 'linear-gradient(135deg, #02AD64 0%, #018a4e 100%)',
      }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            🎁
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">GiftZone</p>
            <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>
              AI Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
              style={active ? {
                background: '#e6f9f1',
                color: '#018a4e',
                borderLeft: '3px solid #02AD64',
                paddingLeft: '9px',
              } : {
                color: '#6b7280',
                borderLeft: '3px solid transparent',
                paddingLeft: '9px',
              }}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
        <button onClick={logout}
          className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm"
          style={{ color: '#9ca3af' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#fef2f2';
            (e.currentTarget as HTMLElement).style.color = '#ef4444';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#9ca3af';
          }}
        >
          <span>🚪</span> Đăng xuất
        </button>
      </div>
    </aside>
  );
}
