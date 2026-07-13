'use client';

import { useState } from 'react';
import { Users, Save } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface Member {
  sender_uid: string;
  sender_name: string;
  role?: string;
}

interface Candidate extends Member {
  msg_count: number;
}

interface Props {
  saved: Member[];
  candidates: Candidate[];
}

export default function GZMemberManager({ saved: initialSaved, candidates }: Props) {
  const { t } = useLocale();
  const ROLES = [
    { value: 'sales',     label: t('ze.accounts.roleSales') },
    { value: 'cs',        label: t('ze.accounts.roleCS') },
    { value: 'manager',   label: t('ze.accounts.roleManager') },
    { value: 'technical', label: t('ze.accounts.roleTechnical') },
  ];
  const savedUids = new Set(initialSaved.map(m => m.sender_uid));
  const savedRoleMap = Object.fromEntries(initialSaved.map(m => [m.sender_uid, m.role ?? 'sales']));

  // selected: Map<uid, role>
  const [selected, setSelected] = useState<Map<string, string>>(
    new Map(initialSaved.map(m => [m.sender_uid, m.role ?? 'sales']))
  );
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(uid: string, defaultRole = 'sales') {
    setSelected(prev => {
      const next = new Map(prev);
      next.has(uid) ? next.delete(uid) : next.set(uid, defaultRole);
      return next;
    });
    setSavedOk(false);
    setError(null);
  }

  function setRole(uid: string, role: string) {
    setSelected(prev => {
      if (!prev.has(uid)) return prev;
      const next = new Map(prev);
      next.set(uid, role);
      return next;
    });
    setSavedOk(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    const candidateUids = new Set(candidates.map(c => c.sender_uid));
    const fromCandidates = candidates
      .filter(c => selected.has(c.sender_uid))
      .map(c => ({ sender_uid: c.sender_uid, sender_name: c.sender_name, role: selected.get(c.sender_uid) ?? 'sales' }));
    const fromSaved = initialSaved
      .filter(m => !candidateUids.has(m.sender_uid) && selected.has(m.sender_uid))
      .map(m => ({ sender_uid: m.sender_uid, sender_name: m.sender_name, role: selected.get(m.sender_uid) ?? 'sales' }));
    const members = [...fromCandidates, ...fromSaved];

    try {
      const res = await fetch('/api/gz-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
      } else {
        setError(null);
        setSavedOk(true);
      }
    } catch {
      setError(t('groups.saveError'));
    }
    setSaving(false);
  }

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-4">
        {t('groups.noCandidates')}
      </p>
    );
  }

  const hasChanged = selected.size !== savedUids.size ||
    [...selected.entries()].some(([uid, role]) => !savedUids.has(uid) || savedRoleMap[uid] !== role);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('groups.selectMembersTitle')}
            </span>
          </div>
          <span className="text-xs text-gray-400">{selected.size} {t('groups.selectedCount')}</span>
        </div>

        <p className="text-xs text-gray-400 px-5 pt-3 pb-1">
          {t('groups.selectMembersHint')}
        </p>

        <ul className="divide-y divide-gray-50">
          {candidates.map(c => {
            const isSelected = selected.has(c.sender_uid);
            const role = selected.get(c.sender_uid) ?? 'sales';
            return (
              <li key={c.sender_uid} className="flex items-center gap-3 px-5 py-3">
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  style={isSelected
                    ? { background: '#02AD64', borderColor: '#02AD64' }
                    : { background: 'white', borderColor: '#d1d5db' }}
                  onClick={() => toggle(c.sender_uid)}
                >
                  {isSelected && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  className="text-sm font-medium text-gray-800 flex-1 cursor-pointer"
                  onClick={() => toggle(c.sender_uid)}
                >
                  {c.sender_name}
                </span>
                {isSelected && (
                  <select
                    value={role}
                    onChange={e => { e.stopPropagation(); setRole(c.sender_uid, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-400 shrink-0"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                )}
                <span className="text-xs text-gray-400 shrink-0">{c.msg_count} {t('common.messages')}</span>
                {savedUids.has(c.sender_uid) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{ background: '#e6f9f1', color: '#018a4e' }}>{t('groups.savedTag')}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p className="text-xs text-red-500 text-right">{error}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || (!hasChanged && !savedOk)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: '#02AD64', color: 'white' }}
        >
          <Save size={14} />
          {saving ? t('common.saving') : savedOk && !hasChanged ? t('common.saved') : t('groups.saveChanges')}
        </button>
      </div>
    </div>
  );
}
