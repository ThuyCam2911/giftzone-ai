'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, UserCheck, Send, CheckCircle2, Loader2, Sparkles, Package, Clock, MessageCircleMore,
  Pencil, Plus, Trash2, Save, X, AlertTriangle, BellRing,
} from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { QuoteNegotiation, QuoteMessage, QuoteItem } from '@/lib/queries/quote-negotiations';
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

// ── Kanban: 3 cột suy ra trực tiếp từ status + has_sales_reply hiện có,
// không cần thêm cột "stage" riêng trong DB — lấy cảm hứng từ Sales Pipeline
// (demo bảo hiểm) nhưng đơn giản hoá cho đúng luồng thật của mình.
type KanbanKey = 'new' | 'in_progress' | 'sent';
const KANBAN_COLUMNS: { key: KanbanKey; vi: string; en: string }[] = [
  { key: 'new', vi: 'Chờ xử lý', en: 'New' },
  { key: 'in_progress', vi: 'Đang trao đổi', en: 'In progress' },
  { key: 'sent', vi: 'Đã gửi khách', en: 'Sent' },
];

function kanbanKeyOf(q: QuoteNegotiation): KanbanKey {
  if (q.status === 'sent_to_customer') return 'sent';
  if (q.has_sales_reply) return 'in_progress';
  return 'new';
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
  const [reminding, setReminding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<QuoteItem[]>([]);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    setEditing(false);
  }, [selectedId]);

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

  async function remind() {
    if (!selectedId || reminding) return;
    setReminding(true);
    try {
      await fetch(`/api/quote-negotiations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind', missingText: 'tên sản phẩm và số lượng/diện tích cần dùng' }),
      });
      await refreshDetail(selectedId);
    } finally {
      setReminding(false);
    }
  }

  function startEdit() {
    if (!selected) return;
    setEditItems(selected.items.map(it => ({ ...it })));
    setEditing(true);
  }

  function updateEditRow(i: number, patch: Partial<QuoteItem>) {
    setEditItems(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function removeEditRow(i: number) {
    setEditItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function addEditRow() {
    setEditItems(prev => [...prev, { product_name: '', unit: '', unit_price: 0, qty: 1 }]);
  }

  async function saveEdit() {
    if (!selectedId || saving) return;
    const clean = editItems.filter(it => it.product_name.trim() && it.unit.trim());
    setSaving(true);
    try {
      await fetch(`/api/quote-negotiations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_items', items: clean }),
      });
      await refreshDetail(selectedId);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const editTotal = editItems.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.qty) || 0), 0);

  return (
    <div className="space-y-4">
      {/* ── Kanban 3 cột — Chờ xử lý / Đang trao đổi / Đã gửi khách ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {KANBAN_COLUMNS.map(col => {
          const colQuotes = quotes.filter(q => kanbanKeyOf(q) === col.key);
          return (
            <div key={col.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {locale === 'en' ? col.en : col.vi}
                </span>
                <span className="text-[11px] font-semibold text-gray-300">{colQuotes.length}</span>
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {colQuotes.map(q => (
                    <motion.button
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedId(q.id)}
                      className="w-full text-left px-4 py-3 border-b border-gray-50 transition-colors"
                      style={selectedId === q.id ? { background: '#e6f9f1' } : undefined}
                    >
                      <p className="text-sm font-semibold text-gray-800 truncate">{q.customer_name || q.customer_uid}</p>
                      <p className="text-xs text-gray-400 mt-1">{money(q.total)} · {q.items.length} {locale === 'en' ? 'items' : 'dòng'}</p>
                    </motion.button>
                  ))}
                </AnimatePresence>
                {colQuotes.length === 0 && (
                  <p className="px-4 py-6 text-xs text-gray-300 text-center">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {quotes.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          {locale === 'en' ? 'No quote requests yet — ask the demo customer to request one on Zalo.' : 'Chưa có phiên báo giá nào — nhắn "báo giá" từ tài khoản khách demo trên Zalo.'}
        </p>
      )}

      {!selected ? (
        <div className="flex items-center justify-center bg-white rounded-2xl border border-gray-200 text-sm text-gray-400 h-[300px]">
          {locale === 'en' ? 'Select a quote above to view details' : 'Chọn 1 thẻ báo giá ở trên để xem chi tiết'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-560px)] min-h-[560px]">
          {/* ── Cột trái: mirror Zalo khách hàng (read-only) ── */}
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
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-base leading-relaxed ${m.responder_type === 'customer' ? 'mr-auto bg-white text-gray-800' : 'ml-auto text-white'}`}
                    style={m.responder_type !== 'customer' ? { background: '#02AD64' } : { border: '1px solid #e5e7eb' }}
                  >
                    {m.content}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={customerEndRef} />
            </div>
          </div>

          {/* ── Cột phải: AI ⇄ Sales negotiation ── */}
          <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Sparkles size={16} className="text-[#02AD64]" />
              <p className="text-sm font-semibold text-gray-800">{locale === 'en' ? 'AI ⇄ Sales' : 'AI ⇄ Sales'}</p>
              <LiveDot />
              <span className="ml-auto"><StatusPill status={selected.status} locale={locale} /></span>
            </div>

            {/* Checklist thiếu thông tin + nhắc khách — chỉ hiện khi chưa có dòng nào */}
            {selected.items.length === 0 && selected.status === 'awaiting_sales' && (
              <div className="mx-4 mt-3 rounded-xl p-3 flex items-start gap-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">
                    {locale === 'en' ? 'Missing info' : 'Thiếu thông tin'}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {locale === 'en' ? "Customer hasn't specified a product/quantity yet." : 'Khách chưa nói rõ sản phẩm/số lượng cần báo giá.'}
                  </p>
                  {selected.reminder_sent_at ? (
                    <p className="text-[11px] text-amber-600 mt-1.5">
                      {locale === 'en' ? 'Reminded at' : 'Đã nhắc lúc'} {new Date(selected.reminder_sent_at).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </p>
                  ) : (
                    <button
                      onClick={remind}
                      disabled={reminding}
                      className="flex items-center gap-1.5 text-xs font-semibold mt-2 px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                      style={{ background: '#b45309' }}
                    >
                      {reminding ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
                      {locale === 'en' ? 'Remind customer' : 'Nhắc khách'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quote card — kiểu "AI Insight", có thể chỉnh tay trực tiếp */}
            <motion.div layout className="mx-4 mt-3 rounded-xl p-4" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                  <Package size={14} /> {locale === 'en' ? 'Draft quote' : 'Đề xuất báo giá'}
                </div>
                {!editing && selected.status === 'awaiting_sales' && (
                  <button onClick={startEdit} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800">
                    <Pencil size={12} /> {locale === 'en' ? 'Edit' : 'Sửa tay'}
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-2">
                  {editItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={it.product_name} onChange={e => updateEditRow(i, { product_name: e.target.value })}
                        placeholder={locale === 'en' ? 'Product' : 'Sản phẩm'}
                        className="flex-[2] min-w-0 px-2 py-1.5 rounded-lg border border-violet-200 text-xs" />
                      <input value={it.unit} onChange={e => updateEditRow(i, { unit: e.target.value })}
                        placeholder={locale === 'en' ? 'Unit' : 'Quy cách'}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-violet-200 text-xs" />
                      <input type="number" value={it.qty} onChange={e => updateEditRow(i, { qty: Number(e.target.value) })}
                        placeholder="SL" className="w-14 px-2 py-1.5 rounded-lg border border-violet-200 text-xs" />
                      <input type="number" value={it.unit_price} onChange={e => updateEditRow(i, { unit_price: Number(e.target.value) })}
                        placeholder={locale === 'en' ? 'Price' : 'Đơn giá'} className="w-20 px-2 py-1.5 rounded-lg border border-violet-200 text-xs" />
                      <button onClick={() => removeEditRow(i)} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={addEditRow} className="flex items-center gap-1 text-xs font-semibold text-violet-600">
                    <Plus size={13} /> {locale === 'en' ? 'Add line' : 'Thêm dòng'}
                  </button>
                  <div className="flex items-center justify-between pt-2 border-t border-violet-100">
                    <span className="text-xs font-semibold text-violet-700">{locale === 'en' ? 'Total' : 'Tổng cộng'}</span>
                    <span className="text-base font-bold text-violet-900">{money(editTotal)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {locale === 'en' ? 'Save' : 'Lưu thay đổi'}
                    </button>
                    <button onClick={() => setEditing(false)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200">
                      <X size={13} /> {locale === 'en' ? 'Cancel' : 'Huỷ'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {selected.items.map((it, i) => (
                      <motion.div
                        key={`${it.product_name}-${it.unit}-${i}`}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between text-sm text-gray-700 py-1"
                      >
                        <span>{it.qty} {it.unit} {it.product_name}</span>
                        <span className="font-medium">{money(it.unit_price * it.qty)}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {selected.items.length === 0 && (
                    <p className="text-sm text-gray-400 italic">{locale === 'en' ? 'No items yet — nudge the AI in chat below, or add manually.' : 'Chưa có dòng nào — nhắn điều chỉnh ở khung chat bên dưới, hoặc bấm "Sửa tay".'}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-violet-100">
                    <span className="text-xs font-semibold text-violet-700">{locale === 'en' ? 'Total' : 'Tổng cộng'}</span>
                    <span className="text-base font-bold text-violet-900">{money(selected.total)}</span>
                  </div>
                </>
              )}
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
                    className="max-w-[92%] rounded-xl p-4"
                    style={{ background: '#f7f6ff', border: '1px solid #ece9fe' }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: '#7c5cff' }}>
                        <Bot size={12} color="white" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7c5cff' }}>
                        {locale === 'en' ? 'AI Assistant' : 'Trợ lý AI'}
                      </span>
                    </div>
                    <p className="text-base text-gray-800 whitespace-pre-line leading-relaxed">{m.text}</p>
                    {m.items_snapshot && m.items_snapshot.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {m.items_snapshot.map((it, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'white', border: '1px solid #ece9fe', color: '#5b21b6' }}>
                            {it.qty} {it.unit} {it.product_name}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] font-mono mt-2.5 pt-2" style={{ color: '#a4a0b8', borderTop: '1px solid #ece9fe' }}>
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
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: '#e6f9f1' }}>
                      <UserCheck size={15} color="#018a4e" />
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl text-base whitespace-pre-line leading-relaxed" style={{ background: '#e6f9f1', color: '#1f2937' }}>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-gray-400 pl-1">
                  <Loader2 size={14} className="animate-spin" /> {locale === 'en' ? 'AI is thinking…' : 'AI đang soạn...'}
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

            <div className="p-4 border-t border-gray-100 space-y-2.5">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendSalesMessage(); }}
                  placeholder={locale === 'en' ? 'e.g. "5% off for the first item"' : 'vd: "giảm 5% cho dòng đầu tiên"'}
                  disabled={selected.status !== 'awaiting_sales'}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-base outline-none focus:border-[#02AD64] disabled:bg-gray-50"
                />
                <button
                  onClick={sendSalesMessage}
                  disabled={selected.status !== 'awaiting_sales' || !input.trim()}
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                  style={{ background: '#02AD64' }}
                >
                  <Send size={18} />
                </button>
              </div>
              <button
                onClick={approve}
                disabled={selected.status !== 'awaiting_sales' || approving || selected.items.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-base font-semibold text-white disabled:opacity-40"
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
        </div>
      )}
    </div>
  );
}
