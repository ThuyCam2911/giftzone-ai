'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send, Bot, UserCheck, Sparkles, Loader2, Plus, MessageCircle, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { InboxThread, InboxMessage } from '@/lib/queries/zenterprise-inbox';

const THREAD_POLL_MS = 6000;
const MSG_POLL_MS = 3000;
const OUTBOUND_POLL_MS = 2000;

type Role = 'customer' | 'employee';

interface DemoMsg {
  id: string;
  role: Role;
  senderId: string;
  senderName: string;
  text: string;
}

interface ScenarioDef {
  key: string;
  labelKey: 'ze.live.scenarioOrder' | 'ze.live.scenarioComplaint' | 'ze.live.scenarioPromo';
  script: { role: Role; text: { vi: string; en: string } }[];
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: 'order',
    labelKey: 'ze.live.scenarioOrder',
    script: [
      { role: 'customer', text: {
        vi: 'Chào shop, cửa hàng Nguyễn Trãi còn combo 2 miếng gà + nước không ạ?',
        en: 'Hi, does the Nguyen Trai branch still have the 2-piece chicken + drink combo?',
      } },
      { role: 'employee', text: {
        vi: 'Dạ chào chị Lan! Cửa hàng còn ạ, combo 2 miếng gà giòn + Pepsi giá 89.000đ ạ.',
        en: 'Hi Ms. Lan! Yes we do — 2 crispy chicken pieces + Pepsi combo is 89,000₫.',
      } },
      { role: 'customer', text: {
        vi: 'Cho mình đặt 2 combo, giao tới 12 Nguyễn Trãi nhé.',
        en: "I'd like to order 2 combos, delivered to 12 Nguyen Trai please.",
      } },
    ],
  },
  {
    key: 'complaint',
    labelKey: 'ze.live.scenarioComplaint',
    script: [
      { role: 'customer', text: {
        vi: 'Đơn của mình đặt 40 phút rồi mà chưa thấy giao, gọi shipper không nghe máy.',
        en: "My order was placed 40 minutes ago and still hasn't arrived, the driver isn't answering.",
      } },
      { role: 'employee', text: {
        vi: 'Dạ em xin lỗi chị, em kiểm tra lại ngay ạ.',
        en: "I'm so sorry, let me check on that right away.",
      } },
      { role: 'customer', text: {
        vi: 'Đây là lần thứ 2 bị trễ rồi đó, mình khá thất vọng.',
        en: "This is the second time it's been late, I'm pretty disappointed.",
      } },
    ],
  },
  {
    key: 'promo',
    labelKey: 'ze.live.scenarioPromo',
    script: [
      { role: 'customer', text: {
        vi: 'Cửa hàng có chương trình tích điểm thành viên không shop?',
        en: 'Does the store have a membership points program?',
      } },
      { role: 'employee', text: {
        vi: 'Dạ có ạ! Chị tích điểm mỗi đơn hàng, đủ 500 điểm đổi được 1 phần gà miễn phí ạ.',
        en: 'Yes! You earn points on every order — 500 points gets you a free chicken portion.',
      } },
    ],
  },
];

const AI_AUTO_REPLY = {
  vi: 'Dạ em đã ghi nhận, GiftZone AI sẽ hỗ trợ mình ngay ạ. Mình chờ chút xíu nhé! 🤖',
  en: "Got it — GiftZone AI is on it, just a moment please! 🤖",
};

let seq = 0;
function nextId() {
  seq += 1;
  return `m${Date.now()}${seq}`;
}

interface DemoThread {
  kind: 'demo';
  id: string;
  scenarioKey: string | null;
  customName?: string;
  messages: DemoMsg[];
  aiMode: boolean;
  analyzed: boolean;
  groupId?: string;
}

interface PendingSend { id: number; text: string; status: 'pending' | 'sent' | 'failed'; error?: string }

function scriptToMessages(s: ScenarioDef, locale: 'vi' | 'en', customerName: string, employeeName: string): DemoMsg[] {
  return s.script.map(line => ({
    id: nextId(),
    role: line.role,
    senderId: line.role === 'customer' ? 'live-customer' : 'live-employee',
    senderName: line.role === 'customer' ? customerName : employeeName,
    text: line.text[locale],
  }));
}

interface Props { initialRealThreads: InboxThread[] }

export default function ZEnterpriseLive({ initialRealThreads }: Props) {
  const { t, locale } = useLocale();

  const CUSTOMER_NAME = locale === 'en' ? 'Customer — Nguyen Thi Lan' : 'Khách hàng — Nguyễn Thị Lan';
  const EMPLOYEE_NAME = locale === 'en' ? 'GiftZone Staff' : 'Nhân viên GiftZone';

  // Real threads — dữ liệu thật, gửi tin ở đây tới đúng khách hàng thật qua Zalo
  const [realThreads, setRealThreads] = useState(initialRealThreads);
  const [realMessages, setRealMessages] = useState<InboxMessage[]>([]);
  const [pending, setPending] = useState<PendingSend[]>([]);
  const [togglingAi, setTogglingAi] = useState(false);

  // Demo threads — seed sẵn để dễ hình dung khi demo, không đụng dữ liệu/khách thật
  const [demoThreads, setDemoThreads] = useState<DemoThread[]>(() =>
    SCENARIOS.map(s => ({
      kind: 'demo',
      id: s.key,
      scenarioKey: s.key,
      messages: scriptToMessages(s, locale, CUSTOMER_NAME, EMPLOYEE_NAME),
      aiMode: true,
      analyzed: false,
    })),
  );

  const [selected, setSelected] = useState<{ kind: 'real' | 'demo'; id: string } | null>(
    initialRealThreads[0] ? { kind: 'real', id: initialRealThreads[0].thread_id } : { kind: 'demo', id: SCENARIOS[0].key },
  );
  const [composerRole, setComposerRole] = useState<Role>('customer');
  const [draft, setDraft] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedRealThread = selected?.kind === 'real' ? realThreads.find(th => th.thread_id === selected.id) ?? null : null;
  const selectedDemoThread = selected?.kind === 'demo' ? demoThreads.find(th => th.id === selected.id) ?? null : null;

  // Poll real thread list
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch('/api/zenterprise/inbox');
      if (res.ok) setRealThreads((await res.json()).threads);
    }, THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // Load + poll selected real thread's messages
  useEffect(() => {
    if (!selectedRealThread) { setRealMessages([]); return; }
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/zenterprise/inbox/${selectedRealThread!.thread_id}`);
      if (res.ok && !cancelled) setRealMessages((await res.json()).messages);
    }
    load();
    const timer = setInterval(load, MSG_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedRealThread?.thread_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [realMessages, selectedDemoThread?.messages.length, selected]);

  // Poll outbound status for pending real sends until resolved
  useEffect(() => {
    const pendingIds = pending.filter(p => p.status === 'pending').map(p => p.id);
    if (pendingIds.length === 0 || !selectedRealThread) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/zenterprise/inbox/${selectedRealThread.thread_id}/status?ids=${pendingIds.join(',')}`);
      if (!res.ok) return;
      const { statuses } = await res.json() as { statuses: { id: number; status: string; error: string | null }[] };
      setPending(prev => prev.map(p => {
        const found = statuses.find(s => s.id === p.id);
        return found ? { ...p, status: found.status as PendingSend['status'], error: found.error ?? undefined } : p;
      }));
    }, OUTBOUND_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, selectedRealThread?.thread_id]);

  function threadName(th: DemoThread): string {
    if (th.scenarioKey) {
      const s = SCENARIOS.find(x => x.key === th.scenarioKey);
      if (s) return t(s.labelKey);
    }
    return th.customName ?? (locale === 'en' ? 'New chat' : 'Đoạn chat mới');
  }

  function createDemoThread() {
    const id = nextId();
    const th: DemoThread = { kind: 'demo', id, scenarioKey: null, customName: locale === 'en' ? 'New chat' : 'Đoạn chat mới', messages: [], aiMode: true, analyzed: false };
    setDemoThreads(prev => [th, ...prev]);
    setSelected({ kind: 'demo', id });
    setComposerRole('customer');
    setError(null);
  }

  function selectThread(kind: 'real' | 'demo', id: string) {
    setSelected({ kind, id });
    setComposerRole('customer');
    setError(null);
  }

  function toggleDemoAiMode(id: string) {
    setDemoThreads(prev => prev.map(th => th.id === id ? { ...th, aiMode: !th.aiMode } : th));
  }

  function appendDemoMessage(threadId: string, msg: DemoMsg) {
    setDemoThreads(prev => prev.map(th => th.id === threadId ? { ...th, messages: [...th.messages, msg] } : th));
  }

  async function toggleRealAi() {
    if (!selectedRealThread) return;
    setTogglingAi(true);
    const nextPaused = !selectedRealThread.ai_paused;
    const res = await fetch(`/api/zenterprise/inbox/${selectedRealThread.thread_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_paused: nextPaused }),
    });
    if (res.ok) {
      setRealThreads(prev => prev.map(th => th.thread_id === selectedRealThread.thread_id ? { ...th, ai_paused: nextPaused } : th));
    }
    setTogglingAi(false);
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    if (selectedRealThread) {
      setDraft('');
      const res = await fetch(`/api/zenterprise/inbox/${selectedRealThread.thread_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const { id } = await res.json();
        setPending(prev => [...prev, { id, text, status: 'pending' }]);
      }
      return;
    }

    if (selectedDemoThread) {
      const threadId = selectedDemoThread.id;
      const msg: DemoMsg = {
        id: nextId(),
        role: composerRole,
        senderId: composerRole === 'customer' ? 'live-customer' : 'live-employee',
        senderName: composerRole === 'customer' ? CUSTOMER_NAME : EMPLOYEE_NAME,
        text,
      };
      appendDemoMessage(threadId, msg);
      setDraft('');

      if (composerRole === 'customer' && selectedDemoThread.aiMode) {
        setTimeout(() => {
          appendDemoMessage(threadId, {
            id: nextId(),
            role: 'employee',
            senderId: 'live-ai',
            senderName: 'GiftZone AI',
            text: AI_AUTO_REPLY[locale],
          });
        }, 700);
      }
    }
  }

  async function analyzeDemoThread() {
    if (!selectedDemoThread || analyzing) return;
    const realMsgs = selectedDemoThread.messages.filter(m => m.text.trim());
    if (realMsgs.length < 2) {
      setError(t('ze.live.finishNeedMore'));
      return;
    }
    setAnalyzing(true);
    setError(null);

    try {
      const payload = {
        scenarioLabel: threadName(selectedDemoThread),
        handoffOccurred: false,
        messages: realMsgs.map(m => ({ senderId: m.senderId, senderName: m.senderName, text: m.text })),
      };
      const res = await fetch('/api/zenterprise/live/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t('ze.live.analyzeFailed'));
      }
      const data = await res.json();
      setDemoThreads(prev => prev.map(th => th.id === selectedDemoThread.id ? { ...th, analyzed: true, groupId: data.groupId } : th));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ze.live.analyzeFailed'));
    } finally {
      setAnalyzing(false);
    }
  }

  const RESPONDER_STYLE: Record<string, { bg: string; align: string }> = {
    customer: { bg: 'bg-gray-100 text-gray-800', align: 'justify-start' },
    ai:       { bg: 'text-white', align: 'justify-end' },
    human:    { bg: 'text-white', align: 'justify-end' },
  };

  return (
    <div className="flex gap-4 min-w-0" style={{ height: 620 }}>
      {/* Thread list */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('ze.live.threadListTitle')}</p>
          <button
            onClick={createDemoThread}
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-white"
            style={{ background: '#02AD64' }}
          >
            <Plus size={12} /> {t('ze.live.newChat')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {realThreads.map(th => (
            <button
              key={th.thread_id}
              onClick={() => selectThread('real', th.thread_id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.kind === 'real' && selected.id === th.thread_id ? 'bg-green-50/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 truncate">{th.name}</p>
                {!th.ai_paused ? (
                  <Bot size={13} className="text-orange-400 shrink-0" />
                ) : (
                  <UserCheck size={13} className="text-blue-500 shrink-0" />
                )}
              </div>
              {th.last_message && <p className="text-xs text-gray-400 truncate mt-0.5">{th.last_message}</p>}
            </button>
          ))}
          {demoThreads.map(th => (
            <button
              key={th.id}
              onClick={() => selectThread('demo', th.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.kind === 'demo' && selected.id === th.id ? 'bg-green-50/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                  {threadName(th)}
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">DEMO</span>
                </p>
                {th.aiMode ? (
                  <Bot size={13} className="text-orange-400 shrink-0" />
                ) : (
                  <UserCheck size={13} className="text-blue-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {th.messages[th.messages.length - 1]?.text ?? '—'}
              </p>
              {th.analyzed && (
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                  {t('ze.live.analyzed')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Thread detail */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 flex flex-col">
        {selectedRealThread ? (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 truncate">{selectedRealThread.name}</p>
              <button
                onClick={toggleRealAi}
                disabled={togglingAi}
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 shrink-0"
                style={selectedRealThread.ai_paused
                  ? { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }
                  : { background: '#fff3eb', color: '#c2410c', borderColor: '#fed7aa' }}
              >
                {selectedRealThread.ai_paused ? <UserCheck size={13} /> : <Bot size={13} />}
                {selectedRealThread.ai_paused ? t('ze.inbox.aiPaused') : t('ze.inbox.aiActive')}
              </button>
            </div>

            {selectedRealThread.ai_paused && (
              <div className="mx-4 mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                <AlertTriangle size={13} className="shrink-0" />
                {t('ze.inbox.aiPausedHint')}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {realMessages.map(m => {
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
            </div>

            <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={t('ze.inbox.composePlaceholder')}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim()}
                className="px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: '#02AD64' }}
              >
                <Send size={14} />
                {t('ze.inbox.send')}
              </button>
            </div>
          </>
        ) : selectedDemoThread ? (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
                {threadName(selectedDemoThread)}
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">DEMO</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleDemoAiMode(selectedDemoThread.id)}
                  className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                  style={selectedDemoThread.aiMode
                    ? { background: '#fff3eb', color: '#c2410c', borderColor: '#fed7aa' }
                    : { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                >
                  {selectedDemoThread.aiMode ? <Bot size={13} /> : <UserCheck size={13} />}
                  {selectedDemoThread.aiMode ? t('ze.live.aiOn') : t('ze.live.aiOff')}
                </button>
                <button
                  onClick={analyzeDemoThread}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #02AD64 0%, #018a4e 100%)' }}
                >
                  {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {t('ze.live.analyzeBtn')}
                </button>
              </div>
            </div>

            {selectedDemoThread.analyzed && selectedDemoThread.groupId && (
              <div className="mx-4 mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center justify-between gap-2">
                <span>{t('ze.live.analyzed')}</span>
                <Link href={`/groups/${selectedDemoThread.groupId}`} className="font-semibold underline shrink-0">
                  {t('ze.live.viewResult')}
                </Link>
              </div>
            )}
            {error && <p className="mx-4 mt-3 text-xs text-red-500">{error}</p>}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#F7F8FA' }}>
              {selectedDemoThread.messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                  <MessageCircle size={28} />
                  <p className="text-xs">{t('ze.live.selectThread')}</p>
                </div>
              )}
              {selectedDemoThread.messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'employee' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    <p className={`text-[10px] text-gray-400 mb-1 ${m.role === 'employee' ? 'text-right' : ''}`}>
                      {m.senderName}
                    </p>
                    <div
                      className="px-3.5 py-2 rounded-2xl text-sm leading-snug"
                      style={
                        m.role === 'employee'
                          ? { background: m.senderId === 'live-ai' ? '#FF6900' : '#02AD64', color: 'white', borderBottomRightRadius: 4 }
                          : { background: 'white', color: '#1f2937', border: '1px solid #e5e7eb', borderBottomLeftRadius: 4 }
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setComposerRole('customer')}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                  style={composerRole === 'customer' ? { background: '#eff6ff', color: '#2563eb' } : { color: '#9ca3af' }}
                >
                  {t('ze.live.customer')}
                </button>
                <button
                  onClick={() => setComposerRole('employee')}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                  style={composerRole === 'employee' ? { background: '#e6f9f1', color: '#018a4e' } : { color: '#9ca3af' }}
                >
                  {EMPLOYEE_NAME}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={composerRole === 'customer' ? t('ze.live.customerPlaceholder') : t('ze.live.employeePlaceholder')}
                  className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#02AD64]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
                  style={{ background: '#02AD64' }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            {t('ze.live.selectThread')}
          </div>
        )}
      </div>
    </div>
  );
}
