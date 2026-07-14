'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WeekChart } from '@/components/ui';
import { MessageSquare, Users2, Bot, AlertTriangle, UserCheck, Store, Building2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { ZDashOverview, ZDashAccountRow, ZDashChatbot, ZDashMonitor } from '@/lib/queries/zenterprise-dashboard';

interface Props {
  overview: ZDashOverview;
  accounts: ZDashAccountRow[];
  chatbot: ZDashChatbot;
  monitor: ZDashMonitor;
  from: string;
  to: string;
  selectedAccountId: number | null;
}

const QUESTION_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  order:     { bg: '#eff6ff', color: '#2563eb' },
  promotion: { bg: '#fff3eb', color: '#c2410c' },
  complaint: { bg: '#fef2f2', color: '#b91c1c' },
  info:      { bg: '#f0fdf4', color: '#166534' },
  other:     { bg: '#f3f4f6', color: '#6b7280' },
};

export default function ZEnterpriseDashboard({ overview, accounts, chatbot, monitor, from: initFrom, to: initTo, selectedAccountId }: Props) {
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

      {/* ── Section 1: zEnterprise Overview ── */}
      <SectionBlock icon={Building2} title={t('ze.dash.sectionOverview')} subtitle={t('ze.dash.sectionOverviewSub')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {displayStats.conversations !== null && (
            <StatCard label={t('ze.dash.statConversations')} value={displayStats.conversations} Icon={Users2} color="#02AD64" bg="#e6f9f1" />
          )}
          <StatCard label={t('ze.dash.statMessages')} value={displayStats.messages} Icon={MessageSquare} color="#2563eb" bg="#eff6ff" />
          {!selectedAccount && (
            <>
              <StatCard label={t('ze.dash.statCustomers')} value={overview.distinctCustomers} Icon={UserCheck} color="#7c3aed" bg="#f5f3ff" />
              <StatCard label={t('ze.dash.statStores')} value={overview.storesActive} Icon={Store} color="#0d9488" bg="#f0fdfa" />
            </>
          )}
        </div>

        {!selectedAccount && <WeekChart days={overview.daysChart} />}

        {/* Accounts comparison table */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('ze.dash.byAccountTitle')}</h3>
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
      </SectionBlock>

      {/* ── Section 2: AI Chatbot ── */}
      <SectionBlock icon={Bot} title={t('ze.dash.sectionChatbot')} subtitle={t('ze.dash.sectionChatbotSub')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('ze.dash.statAiReplies')} value={chatbot.aiReplies} Icon={Bot} color="#FF6900" bg="#fff3eb" />
          <StatCard label={t('ze.dash.statHumanReplies')} value={chatbot.humanReplies} Icon={UserCheck} color="#2563eb" bg="#eff6ff" />
          <StatCard
            label={t('ze.dash.statUnanswered')}
            value={chatbot.unansweredTotal > 0 ? Math.round((chatbot.unanswered / chatbot.unansweredTotal) * 100) : 0}
            suffix="%"
            Icon={AlertTriangle} color="#b91c1c" bg="#fef2f2"
          />
          <StatCard
            label={t('ze.dash.statAvgResponse')}
            value={chatbot.avgResponseMin ?? 0}
            suffix={t('ze.dash.minUnit')}
            Icon={MessageSquare} color="#0d9488" bg="#f0fdfa"
            empty={chatbot.avgResponseMin === null}
          />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('ze.dash.questionTypesTitle')}</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {chatbot.questionTypes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">{t('common.noData')}</p>
            ) : (
              <QuestionTypeBars data={chatbot.questionTypes} t={t} />
            )}
          </div>
        </div>
      </SectionBlock>

      {/* ── Section 3: Monitor ── */}
      <SectionBlock icon={AlertTriangle} title={t('ze.dash.sectionMonitor')} subtitle={t('ze.dash.sectionMonitorSub')}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('ze.dash.issueTypesTitle')}</h3>
            {monitor.issueTypes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">{t('ze.dash.noOpenIssues')}</p>
            ) : (
              <ul className="space-y-2">
                {monitor.issueTypes.map(i => (
                  <li key={i.issue_type} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{t(`deals.issueType.${i.issue_type}` as never) || i.issue_type}</span>
                    <span className="font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#b91c1c' }}>{i.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 mb-1">{t('ze.dash.storesTitle')}</h3>
            {monitor.stores.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">{t('ze.dash.noStores')}</p>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs min-w-[420px]">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 uppercase">{t('ze.dash.colBranch')}</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 uppercase">{t('ze.dash.statCustomers')}</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 uppercase">{t('ze.dash.colMessages')}</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 uppercase">{t('ze.dash.colIssues')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monitor.stores.map(s => (
                      <tr key={s.branch} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800 font-medium">{s.branch}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{s.customers.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{s.messages.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          {s.openIssues > 0 ? (
                            <span className="font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#b91c1c' }}>{s.openIssues}</span>
                          ) : <span className="text-gray-300">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}

function SectionBlock({ icon: Icon, title, subtitle, children }: {
  icon: typeof Building2; title: string; subtitle: string; children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 first:border-t-0 first:pt-0">
        <Icon size={16} className="text-[#02AD64]" />
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function QuestionTypeBars({ data, t }: { data: { type: string; count: number }[]; t: (k: never) => string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <ul className="space-y-2.5">
      {data.map(d => {
        const style = QUESTION_TYPE_STYLE[d.type] ?? QUESTION_TYPE_STYLE.other;
        return (
          <li key={d.type} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: style.color }} className="font-medium">
                {t(`ze.dash.qType.${d.type}` as never) || d.type}
              </span>
              <span className="text-gray-500">{d.count}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(d.count / max) * 100}%`, background: style.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatCard({ label, value, Icon, color, bg, suffix, empty }: {
  label: string; value: number; Icon: typeof MessageSquare; color: string; bg: string; suffix?: string; empty?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={16} style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {empty ? '—' : <>{value.toLocaleString()}{suffix ? <span className="text-sm font-medium ml-0.5">{suffix}</span> : null}</>}
      </p>
    </div>
  );
}
