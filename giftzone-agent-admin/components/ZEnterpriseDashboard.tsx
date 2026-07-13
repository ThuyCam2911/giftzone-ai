'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WeekChart } from '@/components/ui';
import { MessageSquare, Users2, Bot, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { ZDashOverview, ZDashAccountRow } from '@/lib/queries/zenterprise-dashboard';

interface Props {
  overview: ZDashOverview;
  accounts: ZDashAccountRow[];
  from: string;
  to: string;
  selectedAccountId: number | null;
}

export default function ZEnterpriseDashboard({ overview, accounts, from: initFrom, to: initTo, selectedAccountId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);

  function applyFilters(nextAccount?: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('from', from);
    p.set('to', to);
    if (nextAccount !== undefined) {
      if (nextAccount) p.set('account', nextAccount); else p.delete('account');
    }
    startTransition(() => router.push(`/zenterprise/dashboard?${p.toString()}`));
  }

  const roleLabel: Record<string, string> = {
    sales: t('ze.accounts.roleSales'), cs: t('ze.accounts.roleCS'),
    manager: t('ze.accounts.roleManager'), technical: t('ze.accounts.roleTechnical'),
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null;
  const displayStats = selectedAccount
    ? {
        messages: selectedAccount.messages,
        conversations: null as number | null,
        aiQueries: selectedAccount.ai_queries,
        openIssues: selectedAccount.open_issues,
      }
    : {
        messages: overview.messages,
        conversations: overview.conversations,
        aiQueries: overview.aiQueries,
        openIssues: overview.openIssues,
      };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedAccountId ?? ''}
          onChange={e => applyFilters(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 min-w-[180px]"
        >
          <option value="">{t('ze.dash.allAccounts')}</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.account_name}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
        <span className="text-gray-400 text-xs">—</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400" />
        <button onClick={() => applyFilters()}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: '#02AD64' }}>
          {t('common.filter')}
        </button>
      </div>

      {selectedAccount && !selectedAccount.linked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
          {t('ze.dash.noDataForAccount')}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {displayStats.conversations !== null && (
          <StatCard label={t('ze.dash.statConversations')} value={displayStats.conversations} Icon={Users2} color="#02AD64" bg="#e6f9f1" />
        )}
        <StatCard label={t('ze.dash.statMessages')} value={displayStats.messages} Icon={MessageSquare} color="#2563eb" bg="#eff6ff" />
        <StatCard label={t('ze.dash.statAiQueries')} value={displayStats.aiQueries} Icon={Bot} color="#FF6900" bg="#fff3eb" />
        <StatCard label={t('ze.dash.statOpenIssues')} value={displayStats.openIssues} Icon={AlertTriangle} color="#b91c1c" bg="#fef2f2" />
      </div>

      {/* Chart — only meaningful in aggregate view */}
      {!selectedAccount && <WeekChart days={overview.daysChart} />}

      {/* Accounts comparison table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('ze.dash.byAccountTitle')}</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">{t('ze.dash.noAccounts')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.dash.colAccount')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('common.role')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.dash.colMessages')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.dash.colAiQueries')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.dash.colIssues')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map(a => (
                    <tr
                      key={a.id}
                      className={`hover:bg-gray-50 ${selectedAccountId === a.id ? 'bg-green-50/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{a.account_name}</p>
                        {a.branch && <p className="text-xs text-gray-400">{a.branch}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{roleLabel[a.role] ?? a.role}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-700 font-medium">
                        {a.linked ? a.messages.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-700">
                        {a.linked ? a.ai_queries.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.linked && a.open_issues > 0 ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                            {a.open_issues}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">{a.linked ? 0 : '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, color, bg }: { label: string; value: number; Icon: typeof MessageSquare; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={16} style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value.toLocaleString()}</p>
    </div>
  );
}
