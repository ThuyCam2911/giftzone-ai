'use client';

import { useState } from 'react';
import { Plus, Trash2, FolderOpen, ExternalLink } from 'lucide-react';

interface DriveFolder {
  id: number;
  folder_id: string;
  note: string;
  created_at: string;
}

export default function DriveFoldersManager({ initial }: { initial: DriveFolder[] }) {
  const [folders, setFolders] = useState<DriveFolder[]>(initial);
  const [newId, setNewId]     = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  async function add() {
    const folder_id = newId.trim();
    if (!folder_id) { setError('Nhập folder ID'); return; }
    setError('');
    setAdding(true);
    const res = await fetch('/api/drive-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id, note: newNote.trim() }),
    });
    if (res.ok) {
      const { folder } = await res.json();
      setFolders(prev => {
        const idx = prev.findIndex(f => f.folder_id === folder.folder_id);
        return idx >= 0
          ? prev.map((f, i) => (i === idx ? folder : f))
          : [...prev, folder];
      });
      setNewId('');
      setNewNote('');
    } else {
      setError('Lưu thất bại');
    }
    setAdding(false);
  }

  async function remove(id: number) {
    setDeleting(id);
    await fetch(`/api/drive-folders/${id}`, { method: 'DELETE' });
    setFolders(prev => prev.filter(f => f.id !== id));
    setDeleting(null);
  }

  const driveUrl = (folderId: string) =>
    `https://drive.google.com/drive/folders/${folderId}`;

  return (
    <div className="space-y-3">
      {/* List hiện có */}
      {folders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {folders.map(f => (
            <div key={f.id} className="flex items-start gap-3 px-4 py-3">
              <FolderOpen size={15} className="text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-700 truncate">{f.folder_id}</span>
                  <a
                    href={driveUrl(f.folder_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-500 shrink-0"
                  >
                    <ExternalLink size={11} />
                  </a>
                </div>
                {f.note && (
                  <p className="text-xs text-gray-500 mt-0.5">{f.note}</p>
                )}
              </div>
              <button
                onClick={() => remove(f.id)}
                disabled={deleting === f.id}
                className="shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form thêm mới */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 space-y-2">
        <p className="text-xs font-medium text-gray-700 mb-2">Thêm folder mới</p>
        <input
          type="text"
          placeholder="Folder ID (ví dụ: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OM)"
          value={newId}
          onChange={e => setNewId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Ghi chú nội dung (ví dụ: Bảng giá sản phẩm, chính sách bảo hành...)"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={add}
          disabled={adding}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} />
          {adding ? 'Đang lưu...' : 'Thêm'}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Folder ID lấy từ URL Google Drive: drive.google.com/drive/folders/<span className="font-mono">{'<ID>'}</span>
      </p>
    </div>
  );
}
