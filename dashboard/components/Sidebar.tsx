'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const nav = [
  { href: '/overview', label: 'Tổng quan' },
  { href: '/logs',     label: 'AI Logs' },
  { href: '/settings', label: 'Cài đặt' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="font-bold text-gray-900 text-sm">GiftZone</p>
        <p className="text-xs text-gray-400">AI Agent Dashboard</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith(item.href)
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
