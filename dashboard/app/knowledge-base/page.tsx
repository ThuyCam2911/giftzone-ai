'use client';
import { useEffect, useState, useRef } from 'react';

interface FileRow { file_name: string; chunks: string; last_indexed: string }
interface StatsData {
  topQuestions: { question: string; count: string }[];
  unanswered:   { question: string; count: string }[];
  docUsage:     { file_name: string; count: string }[];
}
interface Message { role: 'user' | 'ai'; text: string; sources?: string[]; ms?: number }

export default function KnowledgeBasePage() {
  const [files, setFiles]   = useState<FileRow[]>([]);
  const [stats, setStats]   = useState<StatsData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/knowledge/files').then(r => r.json()).then(setFiles);
    fetch('/api/knowledge/stats').then(r => r.json()).then(setStats);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'ai', text: data.answer, sources: data.sources, ms: data.latency_ms }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: '❌ Có lỗi xảy ra, thử lại sau.' }]);
    } finally {
      setLoading(false);
    }
  }

  const topCount = Math.max(...(stats?.topQuestions.map(q => Number(q.count)) ?? [1]));
  const docMax   = Math.max(...(stats?.docUsage.map(d => Number(d.count)) ?? [1]));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500">Hỏi & truy vấn tài liệu nội bộ.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* File list */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">
            Tài liệu đã index ({files.length} files)
          </p>
          {files.length === 0 && (
            <p className="text-xs text-gray-400">Chưa có tài liệu nào.</p>
          )}
          <ul className="space-y-2">
            {files.map(f => (
              <li key={f.file_name} className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">📄</span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-800 truncate" title={f.file_name}>{f.file_name}</p>
                  <p className="text-[10px] text-gray-400">{f.chunks} chunks</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Chat */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl flex flex-col" style={{ height: 420 }}>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">Hỏi về sản phẩm, chính sách, thể lệ chương trình...</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.sources.map(s => (
                        <span key={s} className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 text-blue-100">
                          📎 {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.ms && <p className="text-[10px] mt-1 opacity-50">{(m.ms / 1000).toFixed(1)}s</p>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-400">Đang tìm...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Hỏi về sản phẩm, chính sách, thể lệ chương trình..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Gửi
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top questions */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Top câu hỏi hay gặp</p>
          {!stats?.topQuestions.length && <p className="text-xs text-gray-400">Chưa có dữ liệu.</p>}
          <ul className="space-y-2">
            {stats?.topQuestions.map(q => (
              <li key={q.question} className="space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs text-gray-700 leading-tight flex-1">{q.question}</p>
                  <span className="text-xs font-medium text-blue-600 shrink-0">{q.count}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${(Number(q.count) / topCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Unanswered */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Câu hỏi AI chưa trả lời được</p>
          <p className="text-[10px] text-gray-400 mb-3">Cần bổ sung tài liệu</p>
          {!stats?.unanswered.length && <p className="text-xs text-gray-400">Không có — tốt!</p>}
          <ul className="space-y-2">
            {stats?.unanswered.map(q => (
              <li key={q.question} className="flex items-start justify-between gap-2">
                <p className="text-xs text-gray-700 leading-tight flex-1">{q.question}</p>
                <span className="shrink-0 text-[10px] bg-orange-50 text-orange-600 border border-orange-200 rounded px-1.5 py-0.5">
                  {q.count}× thiếu doc
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Doc usage */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Tài liệu — mức sử dụng</p>
          <p className="text-[10px] text-gray-400 mb-3">Đo bằng số lần được truy xuất</p>
          {!stats?.docUsage.length && <p className="text-xs text-gray-400">Chưa có dữ liệu.</p>}
          <ul className="space-y-2">
            {stats?.docUsage.map(d => (
              <li key={d.file_name} className="space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs text-gray-700 leading-tight flex-1 truncate" title={d.file_name}>{d.file_name}</p>
                  <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded px-1.5 py-0.5 shrink-0">
                    {d.count} lần
                  </span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full"
                    style={{ width: `${(Number(d.count) / docMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
