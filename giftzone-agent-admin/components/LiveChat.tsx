'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send, Bot, UserCheck, Sparkles, Loader2, Plus, MessageCircle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

type Role = 'customer' | 'employee';

interface ChatMsg {
  id: string;
  role: Role;
  senderId: string;
  senderName: string;
  text: string;
}

interface ScenarioDef {
  key: string;
  labelKey: 'ze.live.scenarioOrder' | 'ze.live.scenarioComplaint' | 'ze.live.scenarioPromo';
  chipKey: 'ze.live.chipOrder' | 'ze.live.chipComplaint' | 'ze.live.chipPromo';
  script: { role: Role; text: { vi: string; en: string } }[];
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: 'order',
    labelKey: 'ze.live.scenarioOrder',
    chipKey: 'ze.live.chipOrder',
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
    chipKey: 'ze.live.chipComplaint',
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
    chipKey: 'ze.live.chipPromo',
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

interface LiveThread {
  id: string;
  scenarioKey: string | null;   // null = blank thread (custom name)
  customName?: string;
  messages: ChatMsg[];
  aiMode: boolean;
  analyzed: boolean;
  groupId?: string;
}

function scriptToMessages(s: ScenarioDef, locale: 'vi' | 'en', customerName: string, employeeName: string): ChatMsg[] {
  return s.script.map(line => ({
    id: nextId(),
    role: line.role,
    senderId: line.role === 'customer' ? 'live-customer' : 'live-employee',
    senderName: line.role === 'customer' ? customerName : employeeName,
    text: line.text[locale],
  }));
}

export default function LiveChat() {
  const { t, locale } = useLocale();

  const CUSTOMER_NAME = locale === 'en' ? 'Customer — Nguyen Thi Lan' : 'Khách hàng — Nguyễn Thị Lan';
  const EMPLOYEE_NAME = locale === 'en' ? 'GiftZone Staff' : 'Nhân viên GiftZone';

  const [threads, setThreads] = useState<LiveThread[]>(() =>
    SCENARIOS.map(s => ({
      id: s.key,
      scenarioKey: s.key,
      messages: scriptToMessages(s, locale, CUSTOMER_NAME, EMPLOYEE_NAME),
      aiMode: true,
      analyzed: false,
    })),
  );
  const [selected, setSelected] = useState<string | null>(SCENARIOS[0]?.key ?? null);
  const [composerRole, setComposerRole] = useState<Role>('customer');
  const [draft, setDraft] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedThread = threads.find(th => th.id === selected) ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [selectedThread?.messages.length, selected]);

  function threadName(th: LiveThread): string {
    if (th.scenarioKey) {
      const s = SCENARIOS.find(x => x.key === th.scenarioKey);
      if (s) return t(s.labelKey);
    }
    return th.customName ?? (locale === 'en' ? 'New chat' : 'Đoạn chat mới');
  }

  function createThread() {
    const id = nextId();
    const th: LiveThread = { id, scenarioKey: null, customName: locale === 'en' ? 'New chat' : 'Đoạn chat mới', messages: [], aiMode: true, analyzed: false };
    setThreads(prev => [th, ...prev]);
    setSelected(id);
    setComposerRole('customer');
    setError(null);
  }

  function selectThread(id: string) {
    setSelected(id);
    setComposerRole('customer');
    setError(null);
  }

  function toggleAiMode(id: string) {
    setThreads(prev => prev.map(th => th.id === id ? { ...th, aiMode: !th.aiMode } : th));
  }

  function appendMessage(threadId: string, msg: ChatMsg) {
    setThreads(prev => prev.map(th => th.id === threadId ? { ...th, messages: [...th.messages, msg] } : th));
  }

  function sendMessage() {
    if (!draft.trim() || !selectedThread) return;
    const threadId = selectedThread.id;
    const msg: ChatMsg = {
      id: nextId(),
      role: composerRole,
      senderId: composerRole === 'customer' ? 'live-customer' : 'live-employee',
      senderName: composerRole === 'customer' ? CUSTOMER_NAME : EMPLOYEE_NAME,
      text: draft.trim(),
    };
    appendMessage(threadId, msg);
    setDraft('');

    if (composerRole === 'customer' && selectedThread.aiMode) {
      setTimeout(() => {
        appendMessage(threadId, {
          id: nextId(),
          role: 'employee',
          senderId: 'live-ai',
          senderName: locale === 'en' ? 'GiftZone AI' : 'GiftZone AI',
          text: AI_AUTO_REPLY[locale],
        });
      }, 700);
    }
  }

  async function analyzeThread() {
    if (!selectedThread || analyzing) return;
    const realMessages = selectedThread.messages.filter(m => m.text.trim());
    if (realMessages.length < 2) {
      setError(t('ze.live.finishNeedMore'));
      return;
    }
    setAnalyzing(true);
    setError(null);

    try {
      const payload = {
        scenarioLabel: threadName(selectedThread),
        handoffOccurred: false,
        messages: realMessages.map(m => ({ senderId: m.senderId, senderName: m.senderName, text: m.text })),
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
      setThreads(prev => prev.map(th => th.id === selectedThread.id ? { ...th, analyzed: true, groupId: data.groupId } : th));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ze.live.analyzeFailed'));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex gap-4 min-w-0" style={{ height: 620 }}>
      {/* Thread list */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('ze.live.threadListTitle')}</p>
          <button
            onClick={createThread}
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-white"
            style={{ background: '#02AD64' }}
          >
            <Plus size={12} /> {t('ze.live.newChat')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map(th => {
            const last = th.messages[th.messages.length - 1];
            return (
              <button
                key={th.id}
                onClick={() => selectThread(th.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected === th.id ? 'bg-green-50/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{threadName(th)}</p>
                  {th.aiMode ? (
                    <Bot size={13} className="text-orange-400 shrink-0" />
                  ) : (
                    <UserCheck size={13} className="text-blue-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{last ? last.text : '—'}</p>
                {th.analyzed && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                    {t('ze.live.analyzed')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread detail */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 flex flex-col">
        {selectedThread ? (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 truncate">{threadName(selectedThread)}</p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleAiMode(selectedThread.id)}
                  className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                  style={selectedThread.aiMode
                    ? { background: '#fff3eb', color: '#c2410c', borderColor: '#fed7aa' }
                    : { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                >
                  {selectedThread.aiMode ? <Bot size={13} /> : <UserCheck size={13} />}
                  {selectedThread.aiMode ? t('ze.live.aiOn') : t('ze.live.aiOff')}
                </button>
                <button
                  onClick={analyzeThread}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #02AD64 0%, #018a4e 100%)' }}
                >
                  {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {t('ze.live.analyzeBtn')}
                </button>
              </div>
            </div>

            {selectedThread.analyzed && selectedThread.groupId && (
              <div className="mx-4 mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center justify-between gap-2">
                <span>{t('ze.live.analyzed')}</span>
                <Link href={`/groups/${selectedThread.groupId}`} className="font-semibold underline shrink-0">
                  {t('ze.live.viewResult')}
                </Link>
              </div>
            )}
            {error && <p className="mx-4 mt-3 text-xs text-red-500">{error}</p>}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#F7F8FA' }}>
              {selectedThread.messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                  <MessageCircle size={28} />
                  <p className="text-xs">{t('ze.live.selectThread')}</p>
                </div>
              )}
              {selectedThread.messages.map(m => (
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
