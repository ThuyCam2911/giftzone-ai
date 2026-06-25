export const dynamic = 'force-dynamic';

import Sidebar from '@/components/Sidebar';
import { getSalesMembersData } from '@/lib/queries/sales-members';
import { Users, Clock, MessageSquare, AlertTriangle } from 'lucide-react';

const ROLE_LABEL: Record<string, string> = { sales: 'Sales', cs: 'CS', manager: 'Manager', technical: 'Tech' };
const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  sales:     { bg: '#e6f9f1', color: '#018a4e' },
  cs:        { bg: '#eef2ff', color: '#4338ca' },
  manager:   { bg: '#fff3eb', color: '#c2410c' },
  technical: { bg: '#f0fdf4', color: '#166534' },
};

function formatResponseTime(min: number | null) {
  if (min === null) return '—';
  if (min < 1) return '< 1 phút';
  if (min < 60) return `${min} phút`;
  return `${Math.round(min / 60)} giờ`;
}

export default async function SalesMembersPage() {
  let members;
  try {
    members = await getSalesMembersData();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
            <p className="font-medium">Không kết nối được database.</p>
            <p className="text-sm mt-2 font-mono break-all">{msg}</p>
          </div>
        </main>
      </div>
    );
  }

  const totalMsgs   = members.reduce((s, m) => s + m.msg_count, 0);
  const totalIssues = members.reduce((s, m) => s + m.open_issues, 0);
  const hasRtData   = members.some(m => m.avg_response_min !== null);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Nhân viên Sales</h1>
          <p className="text-xs text-gray-500 mt-0.5">KPI theo từng nhân viên · 30 ngày gần nhất</p>
        </div>

        <div className="px-4 pb-8 md:px-8 pt-6 max-w-4xl space-y-6">
          {/* KPI summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Nhân viên',       value: members.length, Icon: Users,          color: '#02AD64', bg: '#e6f9f1' },
              { label: 'Tin nhắn / 30ng', value: totalMsgs,      Icon: MessageSquare,  color: '#6366f1', bg: '#eef2ff' },
              { label: 'Issues đang mở',  value: totalIssues,    Icon: AlertTriangle,  color: '#FF6900', bg: '#fff3eb' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{card.label}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                    <card.Icon size={16} style={{ color: card.color }} strokeWidth={1.75} />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Member table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Users size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Chi tiết theo nhân viên</span>
            </div>

            {members.length === 0 ? (
              <div className="py-14 text-center px-4">
                <p className="text-sm text-gray-400">Chưa có nhân viên nào trong danh sách GZ Members.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Vào <a href="/groups" className="underline" style={{ color: '#018a4e' }}>Quản lý nhóm</a> để thêm thành viên.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tên</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Role</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tin nhắn</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Nhóm</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Issues mở</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase flex items-center justify-end gap-1">
                          <Clock size={10} /> TB phản hồi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {members.map(m => {
                        const roleStyle = ROLE_STYLE[m.role] ?? ROLE_STYLE.sales;
                        const isSlowReply = m.avg_response_min !== null && m.avg_response_min > 120;
                        return (
                          <tr key={m.sender_uid} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.sender_name}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={roleStyle}>
                                {ROLE_LABEL[m.role] ?? m.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 text-right font-medium">{m.msg_count.toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs text-gray-600 text-right">{m.group_count}</td>
                            <td className="px-4 py-3 text-right">
                              {m.open_issues > 0 ? (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: '#fef2f2', color: '#b91c1c' }}>
                                  {m.open_issues}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-xs font-semibold ${isSlowReply ? 'text-red-500' : 'text-gray-700'}`}>
                                {formatResponseTime(m.avg_response_min)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!hasRtData && (
                  <div className="px-4 py-3 border-t border-gray-50 bg-amber-50">
                    <p className="text-xs text-amber-700">
                      Dữ liệu thời gian phản hồi chưa có — sẽ tích lũy sau khi agent hoạt động vài ngày.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
