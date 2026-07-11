'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, RefreshCw, Sparkles, ArrowRight, User, Headset, Loader2 } from 'lucide-react';

type Role = 'customer' | 'employee';

interface ChatMsg {
  id: string;
  role: Role;
  senderId: string;   // demo-customer | demo-employee-a | demo-employee-b
  senderName: string;
  text: string;
  system?: boolean;   // divider message (e.g. handoff notice)
}

interface Scenario {
  key: string;
  label: string;
  chip: string;
  script: { role: Role; text: string }[];
}

const CUSTOMER_NAME = 'Khách hàng — Nguyễn Thị Lan';
const EMPLOYEE_A = 'Nhân viên A — CH Nguyễn Trãi';
const EMPLOYEE_B = 'Nhân viên B — CH Nguyễn Trãi';

const SCENARIOS: Scenario[] = [
  {
    key: 'order',
    label: 'Khách đặt combo qua Zalo',
    chip: '🍗 Đặt hàng',
    script: [
      { role: 'customer', text: 'Chào shop, cửa hàng Nguyễn Trãi còn combo 2 miếng gà + nước không ạ?' },
      { role: 'employee', text: 'Dạ chào chị Lan! Cửa hàng còn ạ, combo 2 miếng gà giòn + Pepsi giá 89.000đ ạ.' },
      { role: 'customer', text: 'Cho mình đặt 2 combo, giao tới 12 Nguyễn Trãi nhé.' },
      { role: 'employee', text: 'Dạ em lên đơn 2 combo giao 12 Nguyễn Trãi ngay ạ, khoảng 20 phút sẽ tới.' },
    ],
  },
  {
    key: 'complaint',
    label: 'Khách phàn nàn giao hàng trễ',
    chip: '⚠️ Khiếu nại',
    script: [
      { role: 'customer', text: 'Đơn của mình đặt 40 phút rồi mà chưa thấy giao, gọi shipper không nghe máy.' },
      { role: 'employee', text: 'Dạ em xin lỗi chị, em kiểm tra lại ngay ạ.' },
      { role: 'customer', text: 'Đây là lần thứ 2 bị trễ rồi đó, mình khá thất vọng.' },
      { role: 'employee', text: 'Dạ em rất xin lỗi vì trải nghiệm không tốt này, em sẽ báo quản lý cửa hàng xử lý ngay và tặng chị voucher cho lần sau ạ.' },
    ],
  },
  {
    key: 'promo',
    label: 'Khách hỏi ưu đãi thành viên',
    chip: '🎁 Khuyến mãi',
    script: [
      { role: 'customer', text: 'Cửa hàng có chương trình tích điểm thành viên không shop?' },
      { role: 'employee', text: 'Dạ có ạ! Chị tích điểm mỗi đơn hàng, đủ 500 điểm đổi được 1 phần gà miễn phí ạ.' },
      { role: 'customer', text: 'Vậy đăng ký thành viên sao nè?' },
      { role: 'employee', text: 'Dạ chị chỉ cần chat với tụi em qua Zalo này là tự động được ghi nhận thành viên rồi ạ, không cần app riêng.' },
    ],
  },
];

let seq = 0;
function nextId() {
  seq += 1;
  return `m${Date.now()}${seq}`;
}

function scriptToMessages(s: Scenario): ChatMsg[] {
  return s.script.map(line => ({
    id: nextId(),
    role: line.role,
    senderId: line.role === 'customer' ? 'demo-customer' : 'demo-employee-a',
    senderName: line.role === 'customer' ? CUSTOMER_NAME : EMPLOYEE_A,
    text: line.text,
  }));
}

export default function DemoChat() {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMsg[]>(() => scriptToMessages(SCENARIOS[0]));
  const [handoffDone, setHandoffDone] = useState(false);
  const [composerRole, setComposerRole] = useState<Role>('customer');
  const [draft, setDraft] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function pickScenario(s: Scenario) {
    setScenario(s);
    setMessages(scriptToMessages(s));
    setHandoffDone(false);
    setComposerRole('customer');
    setError(null);
  }

  function currentEmployeeName() {
    return handoffDone ? EMPLOYEE_B : EMPLOYEE_A;
  }
  function currentEmployeeId() {
    return handoffDone ? 'demo-employee-b' : 'demo-employee-a';
  }

  function sendMessage() {
    if (!draft.trim()) return;
    const msg: ChatMsg = {
      id: nextId(),
      role: composerRole,
      senderId: composerRole === 'customer' ? 'demo-customer' : currentEmployeeId(),
      senderName: composerRole === 'customer' ? CUSTOMER_NAME : currentEmployeeName(),
      text: draft.trim(),
    };
    setMessages(prev => [...prev, msg]);
    setDraft('');
  }

  function triggerHandoff() {
    if (handoffDone) return;
    setMessages(prev => [
      ...prev,
      {
        id: nextId(),
        role: 'employee',
        senderId: 'system',
        senderName: 'system',
        text: `🔄 ${EMPLOYEE_A} đã nghỉ việc — công ty thu hồi tài khoản zEnterprise và gán cho ${EMPLOYEE_B}. Toàn bộ lịch sử hội thoại được giữ nguyên.`,
        system: true,
      },
    ]);
    setHandoffDone(true);
  }

  const employeeTurns = useMemo(() => messages.filter(m => m.role === 'employee' && !m.system).length, [messages]);
  const canFinish = messages.filter(m => !m.system).length >= 4;

  async function finishAndAnalyze() {
    if (!canFinish || analyzing) return;
    setAnalyzing(true);
    setError(null);

    const steps = ['Đang đồng bộ hội thoại qua Webhook…', 'AI đang phân tích chất lượng hội thoại…'];
    let stepIdx = 0;
    setStatusText(steps[0]);
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setStatusText(steps[stepIdx]);
    }, 1100);

    try {
      const payload = {
        scenarioLabel: scenario.label,
        handoffOccurred: handoffDone,
        messages: messages
          .filter(m => !m.system)
          .map(m => ({ senderId: m.senderId, senderName: m.senderName, text: m.text })),
      };
      const res = await fetch('/api/demo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Phân tích thất bại');
      }
      const data = await res.json();
      clearInterval(interval);
      router.push(`/groups/${data.groupId}`);
    } catch (e) {
      clearInterval(interval);
      setAnalyzing(false);
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Scenario picker */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Kịch bản demo</p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => pickScenario(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={
                scenario.key === s.key
                  ? { background: '#e6f9f1', color: '#018a4e', borderColor: '#02AD64' }
                  : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
              }
            >
              {s.chip} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employee status bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Headset size={14} className={handoffDone ? 'text-orange-500' : 'text-[#02AD64]'} />
          <span>Tài khoản zEnterprise đang chat:</span>
          <span className="font-semibold text-gray-800">{currentEmployeeName()}</span>
          {handoffDone && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">đã chuyển giao</span>
          )}
        </div>
        <button
          onClick={triggerHandoff}
          disabled={handoffDone || employeeTurns < 1}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: '#FF6900', color: '#FF6900' }}
        >
          <RefreshCw size={12} />
          Mô phỏng: nhân viên nghỉ việc → chuyển giao
        </button>
      </div>

      {/* Chat window */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div ref={scrollRef} className="h-[420px] overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#F7F8FA' }}>
          {messages.map(m =>
            m.system ? (
              <div key={m.id} className="flex justify-center">
                <span className="text-[11px] text-center px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 max-w-md">
                  {m.text}
                </span>
              </div>
            ) : (
              <div key={m.id} className={`flex ${m.role === 'employee' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[75%]">
                  <p className={`text-[10px] text-gray-400 mb-1 ${m.role === 'employee' ? 'text-right' : ''}`}>
                    {m.senderName}
                  </p>
                  <div
                    className="px-3.5 py-2 rounded-2xl text-sm leading-snug"
                    style={
                      m.role === 'employee'
                        ? { background: '#02AD64', color: 'white', borderBottomRightRadius: 4 }
                        : { background: 'white', color: '#1f2937', border: '1px solid #e5e7eb', borderBottomLeftRadius: 4 }
                    }
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setComposerRole('customer')}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
              style={composerRole === 'customer' ? { background: '#eff6ff', color: '#2563eb' } : { color: '#9ca3af' }}
            >
              <User size={12} /> Khách hàng
            </button>
            <button
              onClick={() => setComposerRole('employee')}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
              style={composerRole === 'employee' ? { background: '#e6f9f1', color: '#018a4e' } : { color: '#9ca3af' }}
            >
              <Headset size={12} /> {currentEmployeeName()}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={composerRole === 'customer' ? 'Nhập tin nhắn khách hàng…' : 'Nhập tin nhắn nhân viên…'}
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
      </div>

      {/* Finish CTA */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#02AD64]" />
            Kết thúc hội thoại
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {canFinish
              ? 'Sẵn sàng đồng bộ và phân tích trên Dashboard thật.'
              : `Cần thêm ${4 - messages.filter(m => !m.system).length} tin nhắn nữa để phân tích.`}
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={finishAndAnalyze}
          disabled={!canFinish || analyzing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'linear-gradient(135deg, #02AD64 0%, #018a4e 100%)' }}
        >
          {analyzing ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {statusText}
            </>
          ) : (
            <>
              Xem phân tích trên Dashboard
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
