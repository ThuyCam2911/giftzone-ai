'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, UserCheck, Send, CheckCircle2, Loader2, Sparkles, Package, Clock, MessageCircleMore,
} from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { QuoteNegotiation, QuoteMessage } from '@/lib/queries/quote-negotiations';
import type { InboxMessage } from '@/lib/queries/zenterprise-inbox';

const LIST_POLL_MS = 4000;
// ⚠️ ĐỪNG hạ xuống dưới ~2500ms: Supabase Session Pooler free-tier chỉ có 15
// connection tổng, admin dùng pool max:1/lambda + 2 backend VPS đã chiếm ~10 —
// poll quá nhanh (đã thử 1000ms) làm cạn pool, gây "timeout exceeded when
// trying to connect" cho CHÍNH backend thật đang chạy sản xuất. Cảm giác
// "nhảy liên tục" nên đến từ animation (framer-motion) + LiveDot, không phải
// từ poll interval cực ngắn.
const DETAIL_POLL_MS = 2500;

interface Props { initialQuotes: QuoteNegotiation[] }

const STATUS_LABEL: Record<QuoteNegotiation['status'], { vi: string; en: string; color: string; bg: string }> = {
  awaiting_sales:   { vi: 'Chờ Sales duyệt', en: 'Awaiting Sales', color: '#b45309', bg: '#fef3c7' },
  approved:         { vi: 'Đã duyệt',        en: 'Approved',       color: '#047857', bg: '#d1fae5' },
  sent_to_customer: { vi: 'Đã gửi khách',    en: 'Sent to customer', color: '#1d4ed8', bg: '#dbeafe' },
  cancelled:        { vi: 'Đã huỷ',          en: 'Cancelled',      color: '#6b7280', bg: '#f3f4f6' },
};

function money(n: number) {
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

// Chấm xanh nhấp nháy — tín hiệu trực quan "đang realtime" bên cạnh mỗi khung
// chat, để khi record demo người xem thấy ngay đây không phải màn hình tĩnh
function LiveDot() {
  return (
    <span className="relative flex w-2 h-2">
      <motion.span
        className="absolute inline-flex w-full h-full rounded-full"
        style={{ background: '#22c55e' }}
        animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: '#22c55e' }} />
    </span>
  );
}

function StatusPill({ status, locale }: { status: QuoteNegotiation['status']; locale: 'vi' | 'en' }) {
  const s = STATUS_LABEL[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide"
      style={{ color: s.color, background: s.bg }}
    >
      {locale === 'en' ? s.en : s.vi}
    </span>
  );
}

export default function QuoteDesk({ initialQuotes }: Props) {
  const { locale } = useLocale();
  const [quotes, setQuotes] = useState<QuoteNegotiation[]>(initialQuotes);
  const [selectedId, setSelectedId] = useState<number | null>(initialQuotes[0]?.id ?? null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [customerMessages, setCustomerMessages] = useState<InboxMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const customerEndRef = useRef<HTMLDivElement>(null);

  const selected = quotes.find(q => q.id === selectedId) ?? null;

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch('/api/quote-negotiations');
      if (!res.ok) return;
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    } catch { /* poll lỗi tạm thời — bỏ qua, lần sau thử lại */ }
  }, []);

  const refreshDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/quote-negotiations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setQuotes(prev => prev.map(q => (q.id === id ? data.quote : q)));
      setMessages(data.messages ?? []);
      setCustomerMessages(data.customerMessages ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setInterval(refreshList, LIST_POLL_MS);
    return () => clearInterval(t);
  }, [refreshList]);

  useEffect(() => {
    if (selectedId == null) return;
    refreshDetail(selectedId);
    const t = setInterval(() => refreshDetail(selectedId), DETAIL_POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, refreshDetail]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    customerEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [customerMessages.length]);

  async function sendSalesMessage() {
    const text = input.trim();
    if (!text || !selectedId || sending) return;
    setInput('');
    setSending(true);
    // Optimistic — hiện ngay tin Sales vừa gõ, không đợi vòng poll tiếp theo
    setMessages(prev => [...prev, {
      id: -Date.now(), quote_id: selectedId, sender: 'sales', text, items_snapshot: null, created_at: new Date().toISOString(),
    }]);
    try {
      await fetch(`/api/quote-negotiations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } finally {
      setSending(false);
      refreshDetail(selectedId);
    }
  }

  async function approve() {
    if (!selectedId || approving) return;
    setApproving(true);
    try {
      await fetch(`/api/quote-negotiations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      await refreshDetail(selectedId);
      await refreshList();
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-4 h-[calc(100vh-320px)] min-h-[420px]">
      {/* ── Cột 1: danh sách phiên báo giá ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {locale === 'en' ? 'Active quotes' : 'Phiên báo giá'} · {quotes.length}
        </div>
        <AnimatePresence initial={false}>
          {quotes.map(q => (
            <motion.button
              key={q.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(q.id)}
              className="w-full text-left px-4 py-3 border-b border-gray-50 transition-colors"
              style={selectedId === q.id ? { background: '#e6f9f1' } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {q.customer_name || q.customer_uid}
                </p>
              </div>
              <div className="mt-1"><StatusPill status={q.status} locale={locale} /></div>
              <p className="text-xs text-gray-400 mt-1.5">{money(q.total)} · {q.items.length} {locale === 'en' ? 'items' : 'dòng'}</p>
            </motion.button>
          ))}
        </AnimatePresence>
        {quotes.length === 0 && (
          <p className="px-4 py-8 text-xs text-gray-400 text-center">
            {locale === 'en' ? 'No quote requests yet — ask the demo customer to request one on Zalo.' : 'Chưa có phiên báo giá nào — nhắn "báo giá" từ tài khoản khách demo trên Zalo.'}
          </p>
        )}
      </div>

      {!selected ? (
        <div className="lg:col-span-2 flex items-center justify-center bg-white rounded-2xl border border-gray-200 text-sm text-gray-400">
          {locale === 'en' ? 'Select a quote to view details' : 'Chọn 1 phiên báo giá để xem chi tiết'}
        </div>
      ) : (
        <>
          {/* ── Cột 2: mirror Zalo khách hàng (read-only) ── */}
          <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <MessageCircleMore size={16} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">{selected.customer_name || selected.customer_uid}</p>
              <LiveDot />
              <span className="text-[10px] text-gray-400 ml-auto">{locale === 'en' ? 'Zalo mirror · read-only' : 'Mirror Zalo · chỉ xem'}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#f0f4f2]">
              <AnimatePresence initial={false}>
                {customerMessages.map(m => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.responder_type === 'customer' ? 'mr-auto bg-white text-gray-800' : 'ml-auto text-white'}`}
                    style={m.responder_type !== 'customer' ? { background: '#02AD64' } : { border: '1px solid #e5e7eb' }}
                  >
                    {m.content}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={customerEndRef} />
            </div>
          </div>

          {/* ── Cột 3: AI ⇄ Sales negotiation ── */}
          <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Sparkles size={16} className="text-[#02AD64]" />
              <p className="text-sm font-semibold text-gray-800">{locale === 'en' ? 'AI ⇄ Sales' : 'AI ⇄ Sales'}</p>
              <LiveDot />
              <span className="ml-auto"><StatusPill status={selected.status} locale={locale} /></span>
            </div>

            {/* Quote card — kiểu "AI Insight" */}
            <motion.div layout className="mx-4 mt-3 rounded-xl p-3" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 mb-1.5">
                <Package size={13} /> {locale === 'en' ? 'Draft quote' : 'Đề xuất báo giá'}
              </div>
              <AnimatePresence initial={false}>
                {selected.items.map((it, i) => (
                  <motion.div
                    key={`${it.product_name}-${it.unit}-${i}`}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between text-xs text-gray-700 py-0.5"
                  >
                    <span>{it.qty} {it.unit} {it.product_name}</span>
                    <span className="font-medium">{money(it.unit_price * it.qty)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {selected.items.length === 0 && (
                <p className="text-xs text-gray-400 italic">{locale === 'en' ? 'No items yet — nudge the AI in chat below.' : 'Chưa có dòng nào — nhắn điều chỉnh ở khung chat bên dưới.'}</p>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-violet-100">
                <span className="text-[11px] font-semibold text-violet-700">{locale === 'en' ? 'Total' : 'Tổng cộng'}</span>
                <span className="text-sm font-bold text-violet-900">{money(selected.total)}</span>
              </div>
            </motion.div>

            {/* Chat AI ⇄ Sales — kiểu "Trợ lý": AI trả lời là 1 card có chip + nội dung + dòng nguồn, Sales là bubble đơn giản */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 mt-1">
              <AnimatePresence initial={false}>
                {messages.map(m => m.sender === 'ai' ? (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="max-w-[92%] rounded-xl p-3"
                    style={{ background: '#f7f6ff', border: '1px solid #ece9fe' }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: '#7c5cff' }}>
                        <Bot size={10} color="white" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#7c5cff' }}>
                        {locale === 'en' ? 'AI Assistant' : 'Trợ lý AI'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-line">{m.text}</p>
                    {m.items_snapshot && m.items_snapshot.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.items_snapshot.map((it, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'white', border: '1px solid #ece9fe', color: '#5b21b6' }}>
                            {it.qty} {it.unit} {it.product_name}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] font-mono mt-2 pt-1.5" style={{ color: '#a4a0b8', borderTop: '1px solid #ece9fe' }}>
                      nguồn: product_prices · demo
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="flex items-start gap-2 max-w-[85%] ml-auto flex-row-reverse"
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: '#e6f9f1' }}>
                      <UserCheck size={13} color="#018a4e" />
                    </div>
                    <div className="px-3 py-2 rounded-2xl text-sm whitespace-pre-line" style={{ background: '#e6f9f1', color: '#1f2937' }}>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-gray-400 pl-1">
                  <Loader2 size={12} className="animate-spin" /> {locale === 'en' ? 'AI is thinking…' : 'AI đang soạn...'}
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {selected.status === 'sent_to_customer' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mb-3 rounded-xl p-3" style={{ background: '#eef2ff', border: '1px solid #e0e7ff' }}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#4338ca' }}>
                  <Send size={12} /> {locale === 'en' ? 'Handed off to Zalo' : 'Đã bàn giao qua Zalo'}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {locale === 'en' ? 'Final quote enqueued to outbound_messages — the bot will deliver it to the customer over Zalo.' : 'Báo giá cuối đã đưa vào hàng đợi outbound_messages — bot sẽ gửi cho khách qua Zalo.'}
                </p>
              </motion.div>
            )}

            <div className="p-3 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendSalesMessage(); }}
                  placeholder={locale === 'en' ? 'e.g. "5% off for the first item"' : 'vd: "giảm 5% cho dòng đầu tiên"'}
                  disabled={selected.status !== 'awaiting_sales'}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#02AD64] disabled:bg-gray-50"
                />
                <button
                  onClick={sendSalesMessage}
                  disabled={selected.status !== 'awaiting_sales' || !input.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                  style={{ background: '#02AD64' }}
                >
                  <Send size={16} />
                </button>
              </div>
              <button
                onClick={approve}
                disabled={selected.status !== 'awaiting_sales' || approving || selected.items.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: '#018a4e' }}
              >
                {approving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {selected.status === 'sent_to_customer'
                  ? (locale === 'en' ? 'Sent to customer ✓' : 'Đã gửi khách ✓')
                  : (locale === 'en' ? 'Approve & send to customer' : 'Duyệt & gửi khách')}
              </button>
              {selected.status === 'sent_to_customer' && (
                <p className="flex items-center gap-1 text-[11px] text-gray-400 justify-center">
                  <Clock size={11} /> {new Date(selected.updated_at).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
