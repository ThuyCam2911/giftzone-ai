'use client';
import Sidebar from '@/components/Sidebar';
import { useEffect, useState, useRef } from 'react';
import { FileText, Paperclip } from 'lucide-react';

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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 pt-18 pb-3 md:pt-4 md:px-8 md:pb-4">
          <h1 className="text-lg font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-xs text-gray-500 mt-0.5">Hỏi & truy vấn tài liệu nội bộ</p>
        </div>

        <div className="px-4 pb-8 md:px-8 pt-6 space-y-6 max-w-5xl mx-auto">
          {/* ── Top: file list + chat ── */}
          <div className="flex flex-col lg:flex-row gap-4 min-w-0">
            {/* File list */}
            <div className="lg:w-56 shrink-0 bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                Tài liệu đã index ({files.length} files)
              </p>
              {files.length === 0 && (
                <p className="text-xs text-gray-400">Chưa có tài liệu nào.</p>
              )}
              <ul className="space-y-2">
                {files.map(f => (
                  <li key={f.file_name} className="flex items-start gap-2">
                    <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" strokeWidth={1.75} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 break-words" title={f.file_name}>{f.file_name}</p>
                      <p className="text-[10px] text-gray-400">{f.chunks} chunks</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat */}
            <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl flex flex-col" style={{ height: 440 }}>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-400 text-center mt-8">Hỏi về sản phẩm, chính sách, thể lệ chương trình...</p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      m.role === 'user' ? 'text-white' : 'bg-gray-100 text-gray-800'
                    }`} style={m.role === 'user' ? { background: '#02AD64' } : {}}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.sources.map(s => (
                            <span key={s} className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 text-green-100">
                              <Paperclip size={10} className="inline mr-0.5" />{s}
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
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50"
                  style={{ background: '#02AD64' }}
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats: 3 cols responsive ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top questions */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Top câu hỏi hay gặp</p>
              <p className="text-[10px] text-gray-400 mb-3">Tổng hợp từ lịch sử</p>
              {!stats?.topQuestions.length && <p className="text-xs text-gray-400">Chưa có dữ liệu.</p>}
              <ul className="space-y-2">
                {stats?.topQuestions.map(q => (
                  <li key={q.question} className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-xs text-gray-700 leading-tight flex-1 break-words">{q.question}</p>
                      <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                        style={{ background: '#fff3eb', color: '#FF6900' }}>{q.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(Number(q.count) / topCount) * 100}%`, background: '#02AD64' }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Unanswered */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">AI chưa trả lời được</p>
              <p className="text-[10px] text-gray-400 mb-3">Cần bổ sung tài liệu</p>
              {!stats?.unanswered.length && <p className="text-xs text-gray-400">Không có — tốt!</p>}
              <ul className="space-y-2">
                {stats?.unanswered.map(q => (
                  <li key={q.question} className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-700 leading-tight flex-1 break-words">{q.question}</p>
                    <span className="shrink-0 text-[10px] bg-orange-50 text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {q.count}× thiếu doc
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Doc usage */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Tài liệu — mức sử dụng</p>
              <p className="text-[10px] text-gray-400 mb-3">Đo bằng số lần được truy xuất</p>
              {!stats?.docUsage.length && <p className="text-xs text-gray-400">Chưa có dữ liệu.</p>}
              <ul className="space-y-2">
                {stats?.docUsage.map(d => (
                  <li key={d.file_name} className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-xs text-gray-700 leading-tight flex-1 break-words" title={d.file_name}>{d.file_name}</p>
                      <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                        {d.count} lần
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(Number(d.count) / docMax) * 100}%`, background: '#0d9488' }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
