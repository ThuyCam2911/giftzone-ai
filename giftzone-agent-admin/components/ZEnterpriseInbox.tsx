'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Bot, UserCheck, Send, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { InboxThread, InboxMessage } from '@/lib/queries/zenterprise-inbox';

const THREAD_POLL_MS = 6000;
const MSG_POLL_MS = 3000;
const OUTBOUND_POLL_MS = 2000;

interface PendingSend { id: number; text: string; status: 'pending' | 'sent' | 'failed'; error?: string }

export default function ZEnterpriseInbox({ initialThreads }: { initialThreads: InboxThread[] }) {
  const { t } = useLocale();
  const [threads, setThreads] = useState(initialThreads);
  const [selected, setSelected] = useState<string | null>(initialThreads[0]?.thread_id ?? null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingSend[]>([]);
  const [togglingAi, setTogglingAi] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedThread = threads.find(th => th.thread_id === selected) ?? null;

  // Poll thread list
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch('/api/zenterprise/inbox');
      if (res.ok) setThreads((await res.json()).threads);
    }, THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // Load + poll selected thread's messages
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/zenterprise/inbox/${selected}`);
      if (res.ok && !cancelled) setMessages((await res.json()).messages);
    }
    load();
    const timer = setInterval(load, MSG_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll outbound status for pending sends until resolved
  useEffect(() => {
    const pendingIds = pending.filter(p => p.status === 'pending').map(p => p.id);
    if (pendingIds.length === 0 || !selected) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/zenterprise/inbox/${selected}/status?ids=${pendingIds.join(',')}`);
      if (!res.ok) return;
      const { statuses } = await res.json() as { statuses: { id: number; status: string; error: string | null }[] };
      setPending(prev => prev.map(p => {
        const found = statuses.find(s => s.id === p.id);
        return found ? { ...p, status: found.status as PendingSend['status'], error: found.error ?? undefined } : p;
      }));
    }, OUTBOUND_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, selected]);

  async function send() {
    const text = input.trim();
    if (!text || !selected) return;
    setInput('');
    const res = await fetch(`/api/zenterprise/inbox/${selected}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const { id } = await res.json();
      setPending(prev => [...prev, { id, text, status: 'pending' }]);
    }
  }

  async function toggleAi() {
    if (!selectedThread) return;
    setTogglingAi(true);
    const nextPaused = !selectedThread.ai_paused;
    const res = await fetch(`/api/zenterprise/inbox/${selectedThread.thread_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_paused: nextPaused }),
    });
    if (res.ok) {
      setThreads(prev => prev.map(th => th.thread_id === selectedThread.thread_id ? { ...th, ai_paused: nextPaused } : th));
    }
    setTogglingAi(false);
  }

  const RESPONDER_STYLE: Record<string, { bg: string; align: string; label?: string }> = {
    customer: { bg: 'bg-gray-100 text-gray-800', align: 'justify-start' },
    ai:       { bg: 'text-white', align: 'justify-end' },
    human:    { bg: 'text-white', align: 'justify-end' },
  };

  if (threads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <MessageCircle size={28} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">{t('ze.inbox.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-w-0" style={{ height: 620 }}>
      {/* Thread list */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 overflow-y-auto">
        {threads.map(th => (
          <button
            key={th.thread_id}
            onClick={() => setSelected(th.thread_id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected === th.thread_id ? 'bg-green-50/60' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-800 truncate">{th.name}</p>
              {!th.ai_paused ? (
                <Bot size={13} className="text-orange-400 shrink-0" />
              ) : (
                <UserCheck size={13} className="text-blue-500 shrink-0" />
              )}
            </div>
            {th.last_message && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{th.last_message}</p>
            )}
          </button>
        ))}
      </div>

      {/* Thread detail */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 flex flex-col">
        {selectedThread ? (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 truncate">{selectedThread.name}</p>
              <button
                onClick={toggleAi}
                disabled={togglingAi}
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 shrink-0"
                style={selectedThread.ai_paused
                  ? { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }
                  : { background: '#fff3eb', color: '#c2410c', borderColor: '#fed7aa' }}
              >
                {selectedThread.ai_paused ? <UserCheck size={13} /> : <Bot size={13} />}
                {selectedThread.ai_paused ? t('ze.inbox.aiPaused') : t('ze.inbox.aiActive')}
              </button>
            </div>

            {selectedThread.ai_paused && (
              <div className="mx-4 mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                <AlertTriangle size={13} className="shrink-0" />
                {t('ze.inbox.aiPausedHint')}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map(m => {
                const style = RESPONDER_STYLE[m.responder_type] ?? RESPONDER_STYLE.customer;
                return (
                  <div key={m.id} className={`flex ${style.align}`}>
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${style.bg}`}
                      style={m.responder_type !== 'customer' ? { background: m.responder_type === 'ai' ? '#FF6900' : '#02AD64' } : {}}
                    >
                      {m.responder_type !== 'customer' && (
                        <p className="text-[10px] font-semibold opacity-80 mb-0.5">
                          {m.responder_type === 'ai' ? t('ze.inbox.aiSender') : t('ze.inbox.humanSender')}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              {pending.map(p => (
                <div key={p.id} className="flex justify-end">
                  <div className="max-w-[75%] rounded-xl px-3 py-2 text-sm text-white opacity-70" style={{ background: '#02AD64' }}>
                    <p className="whitespace-pre-wrap">{p.text}</p>
                    <p className="text-[10px] mt-1 opacity-80">
                      {p.status === 'pending' && t('ze.inbox.sending')}
                      {p.status === 'sent' && t('ze.inbox.sent')}
                      {p.status === 'failed' && `${t('ze.inbox.sendFailed')}${p.error ? `: ${p.error}` : ''}`}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={t('ze.inbox.composePlaceholder')}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: '#02AD64' }}
              >
                <Send size={14} />
                {t('ze.inbox.send')}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            {t('ze.inbox.selectThread')}
          </div>
        )}
      </div>
    </div>
  );
}
