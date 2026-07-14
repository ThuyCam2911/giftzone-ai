'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Link2, UserCircle2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { ZEnterpriseAccount, LinkCandidate } from '@/lib/queries/zenterprise';

type Role = ZEnterpriseAccount['role'];
type Status = ZEnterpriseAccount['status'];

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  active:   { bg: '#e6f9f1', color: '#018a4e' },
  inactive: { bg: '#f3f4f6', color: '#6b7280' },
};

const ROLE_STYLE: Record<Role, { bg: string; color: string }> = {
  sales:     { bg: '#e6f9f1', color: '#018a4e' },
  cs:        { bg: '#eef2ff', color: '#4338ca' },
  manager:   { bg: '#fff3eb', color: '#c2410c' },
  technical: { bg: '#f0fdf4', color: '#166534' },
};

interface FormState {
  id: number | null;
  account_name: string;
  email: string;
  password: string;
  hasPassword: boolean;
  branch: string;
  role: Role;
  status: Status;
  linked_sender_uid: string;
}

const EMPTY_FORM: FormState = {
  id: null, account_name: '', email: '', password: '', hasPassword: false, branch: '', role: 'sales', status: 'active', linked_sender_uid: '',
};

export default function ZEnterpriseAccountsManager({
  initialAccounts, candidates,
}: {
  initialAccounts: ZEnterpriseAccount[];
  candidates: LinkCandidate[];
}) {
  const { t } = useLocale();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const roleLabel: Record<Role, string> = {
    sales: t('ze.accounts.roleSales'), cs: t('ze.accounts.roleCS'),
    manager: t('ze.accounts.roleManager'), technical: t('ze.accounts.roleTechnical'),
  };

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(a: ZEnterpriseAccount) {
    setForm({
      id: a.id, account_name: a.account_name, email: a.email ?? '', password: '', hasPassword: a.has_password,
      branch: a.branch ?? '', role: a.role, status: a.status, linked_sender_uid: a.linked_sender_uid ?? '',
    });
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    if (!form.account_name.trim()) { setError(t('ze.accounts.nameRequired')); return; }
    setSaving(true);
    setError(null);
    const payload = {
      account_name: form.account_name.trim(),
      email: form.email.trim() || null,
      password: form.password.trim() || undefined,
      branch: form.branch.trim() || null,
      role: form.role,
      status: form.status,
      linked_sender_uid: form.linked_sender_uid || null,
    };
    try {
      const res = form.id
        ? await fetch(`/api/zenterprise/accounts/${form.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch('/api/zenterprise/accounts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error();

      const linkedCandidate = candidates.find(c => c.sender_uid === form.linked_sender_uid);
      const { password, ...rest } = payload;
      const accountFields = { ...rest, has_password: !!password || form.hasPassword };
      if (form.id) {
        setAccounts(prev => prev.map(a => a.id === form.id
          ? { ...a, ...accountFields, linked_sender_name: linkedCandidate?.sender_name ?? null }
          : a));
      } else {
        const data = await res.json();
        setAccounts(prev => [...prev, {
          id: data.id, phone: null, ...accountFields,
          linked_sender_name: linkedCandidate?.sender_name ?? null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]);
      }
      setFormOpen(false);
    } catch {
      setError(t('ze.accounts.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm(t('ze.accounts.deleteConfirm'))) return;
    setDeletingId(id);
    await fetch(`/api/zenterprise/accounts/${id}`, { method: 'DELETE' });
    setAccounts(prev => prev.filter(a => a.id !== id));
    setDeletingId(null);
  }

  const totalActive = accounts.filter(a => a.status === 'active').length;
  const totalInactive = accounts.length - totalActive;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">{t('ze.accounts.statTotal')}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">{t('ze.accounts.statActive')}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#02AD64' }}>{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">{t('ze.accounts.statInactive')}</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{totalInactive}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: '#02AD64' }}
        >
          <Plus size={15} /> {t('ze.accounts.newAccount')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12 px-4">{t('ze.accounts.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.accounts.colAccount')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.accounts.colBranch')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.accounts.colRole')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.accounts.colLinked')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.accounts.colStatus')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t('ze.accounts.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCircle2 size={18} className="text-gray-300 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.account_name}</p>
                          {a.email && <p className="text-xs text-gray-400">{a.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.branch || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={ROLE_STYLE[a.role]}>
                        {roleLabel[a.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.linked_sender_name ? (
                        <span className="flex items-center gap-1 text-gray-700">
                          <Link2 size={11} className="text-gray-400" /> {a.linked_sender_name}
                        </span>
                      ) : (
                        <span className="text-gray-300">{t('ze.accounts.notLinked')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={STATUS_STYLE[a.status]}>
                        {a.status === 'active' ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(a.id)}
                          disabled={deletingId === a.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {form.id ? t('ze.accounts.editAccount') : t('ze.accounts.newAccount')}
              </h3>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formName')}</label>
                <input
                  value={form.account_name}
                  onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                  placeholder={t('ze.accounts.formNamePlaceholder')}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formEmail')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder={t('ze.accounts.formEmailPlaceholder')}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formPassword')}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={form.hasPassword ? t('ze.accounts.formPasswordKeepPlaceholder') : t('ze.accounts.formPasswordPlaceholder')}
                  autoComplete="new-password"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formBranch')}</label>
                <input
                  value={form.branch}
                  onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                  placeholder={t('ze.accounts.formBranchPlaceholder')}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formRole')}</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="sales">{t('ze.accounts.roleSales')}</option>
                    <option value="cs">{t('ze.accounts.roleCS')}</option>
                    <option value="manager">{t('ze.accounts.roleManager')}</option>
                    <option value="technical">{t('ze.accounts.roleTechnical')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formStatus')}</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="active">{t('common.active')}</option>
                    <option value="inactive">{t('common.inactive')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t('ze.accounts.formLinked')}</label>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-1">{t('ze.accounts.formLinkedHint')}</p>
                <select
                  value={form.linked_sender_uid}
                  onChange={e => setForm(f => ({ ...f, linked_sender_uid: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">{t('ze.accounts.formLinkedNone')}</option>
                  {candidates.map(c => (
                    <option key={c.sender_uid} value={c.sender_uid}>
                      {c.sender_name} ({c.msg_count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm rounded-lg text-gray-500 hover:bg-gray-100">
                {t('common.cancel')}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                style={{ background: '#02AD64' }}
              >
                {saving ? t('common.saving') : t('ze.accounts.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
