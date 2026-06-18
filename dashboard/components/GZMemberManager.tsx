'use client';

import { useState } from 'react';
import { Users, Save } from 'lucide-react';

interface Member {
  sender_uid: string;
  sender_name: string;
}

interface Candidate extends Member {
  msg_count: number;
}

interface Props {
  saved: Member[];
  candidates: Candidate[];
}

export default function GZMemberManager({ saved: initialSaved, candidates }: Props) {
  const savedUids = new Set(initialSaved.map(m => m.sender_uid));
  // initialSaved dùng để preserve members ngoài top-50 candidates khi save
  const [selected, setSelected] = useState<Set<string>>(savedUids);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(uid: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    // Giữ lại saved members không có trong candidates (ngoài top 50)
    const fromCandidates = candidates
      .filter(c => selected.has(c.sender_uid))
      .map(c => ({ sender_uid: c.sender_uid, sender_name: c.sender_name }));
    const candidateUids = new Set(candidates.map(c => c.sender_uid));
    const fromSaved = initialSaved.filter(m => !candidateUids.has(m.sender_uid));
    const members = [...fromCandidates, ...fromSaved];

    await fetch('/api/gz-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members }),
    });
    setSaving(false);
    setSaved(true);
  }

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-4">
        Chưa có dữ liệu — sẽ hiển thị danh sách người đã nhắn tin trong nhóm khách sau khi agent nhận được tin nhắn.
      </p>
    );
  }

  const changed = selected.size !== savedUids.size ||
    [...selected].some(uid => !savedUids.has(uid));

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Chọn thành viên team GiftZone
            </span>
          </div>
          <span className="text-xs text-gray-400">{selected.size} đã chọn</span>
        </div>

        <p className="text-xs text-gray-400 px-5 pt-3 pb-1">
          Tick những người là nhân viên GZ. AI sẽ chỉ cảnh báo khi khách chưa được GZ reply — bỏ qua khi khách đang trao đổi nội bộ với nhau.
        </p>

        <ul className="divide-y divide-gray-50">
          {candidates.map(c => {
            const isSelected = selected.has(c.sender_uid);
            return (
              <li
                key={c.sender_uid}
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggle(c.sender_uid)}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={isSelected
                    ? { background: '#02AD64', borderColor: '#02AD64' }
                    : { background: 'white', borderColor: '#d1d5db' }}
                >
                  {isSelected && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-800 flex-1">{c.sender_name}</span>
                <span className="text-xs text-gray-400 shrink-0">{c.msg_count} tin nhắn</span>
                {savedUids.has(c.sender_uid) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{ background: '#e6f9f1', color: '#018a4e' }}>đã lưu</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || (!changed && !saved)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: '#02AD64', color: 'white' }}
        >
          <Save size={14} />
          {saving ? 'Đang lưu...' : saved && !changed ? 'Đã lưu' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  );
}
