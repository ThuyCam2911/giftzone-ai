import { query } from '@/lib/db';

export interface QuoteItem {
  product_name: string;
  unit: string;
  unit_price: number;
  qty: number;
}

export interface QuoteNegotiation {
  id: number;
  customer_uid: string;
  customer_name: string | null;
  status: 'awaiting_sales' | 'approved' | 'sent_to_customer' | 'cancelled';
  items: QuoteItem[];
  total: number;
  ai_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteMessage {
  id: number;
  quote_id: number;
  sender: 'ai' | 'sales';
  text: string;
  items_snapshot: QuoteItem[] | null;
  created_at: string;
}

// Bảng đã được backend tạo (utils/db.js initSchema()) khi backend chạy lần đầu
// trên nhánh ai-for-demo — tạo lại ở đây (IF NOT EXISTS) phòng trường hợp
// Dashboard được mở trước khi backend từng chạy.
export async function ensureQuoteTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS quote_negotiations (
      id            SERIAL PRIMARY KEY,
      customer_uid  TEXT NOT NULL,
      customer_name TEXT,
      status        TEXT NOT NULL DEFAULT 'awaiting_sales',
      items         JSONB NOT NULL DEFAULT '[]',
      total         NUMERIC,
      ai_note       TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS quote_negotiation_messages (
      id             SERIAL PRIMARY KEY,
      quote_id       INTEGER NOT NULL REFERENCES quote_negotiations(id) ON DELETE CASCADE,
      sender         TEXT NOT NULL,
      text           TEXT NOT NULL,
      items_snapshot JSONB,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function parseRow(r: any): QuoteNegotiation {
  return {
    ...r,
    total: Number(r.total ?? 0),
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items ?? []),
  };
}

export async function listActiveQuotes(): Promise<QuoteNegotiation[]> {
  await ensureQuoteTables();
  const rows = await query<any>(
    `SELECT * FROM quote_negotiations WHERE status != 'cancelled' ORDER BY updated_at DESC LIMIT 50`
  );
  return rows.map(parseRow);
}

export async function getQuote(id: number): Promise<QuoteNegotiation | null> {
  await ensureQuoteTables();
  const rows = await query<any>(`SELECT * FROM quote_negotiations WHERE id = $1`, [id]);
  return rows[0] ? parseRow(rows[0]) : null;
}

export async function getQuoteMessages(id: number): Promise<QuoteMessage[]> {
  await ensureQuoteTables();
  const rows = await query<any>(
    `SELECT * FROM quote_negotiation_messages WHERE quote_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  return rows.map(r => ({
    ...r,
    items_snapshot: r.items_snapshot
      ? (typeof r.items_snapshot === 'string' ? JSON.parse(r.items_snapshot) : r.items_snapshot)
      : null,
  }));
}

export async function addMessage(
  quoteId: number,
  sender: 'ai' | 'sales',
  text: string,
  itemsSnapshot: QuoteItem[] | null = null
): Promise<void> {
  await query(
    `INSERT INTO quote_negotiation_messages (quote_id, sender, text, items_snapshot) VALUES ($1, $2, $3, $4)`,
    [quoteId, sender, text, itemsSnapshot ? JSON.stringify(itemsSnapshot) : null]
  );
}

export async function updateQuoteItems(id: number, items: QuoteItem[]): Promise<void> {
  const total = items.reduce((s, it) => s + it.unit_price * it.qty, 0);
  await query(
    `UPDATE quote_negotiations SET items = $2, total = $3, updated_at = NOW() WHERE id = $1`,
    [id, JSON.stringify(items), total]
  );
}

export async function approveQuote(id: number): Promise<QuoteNegotiation | null> {
  await ensureQuoteTables();
  const quote = await getQuote(id);
  if (!quote) return null;

  const lines = quote.items
    .map(it => `- ${it.qty} ${it.unit} ${it.product_name}: ${Math.round(it.unit_price * it.qty).toLocaleString('vi-VN')}đ`)
    .join('\n');
  const text = `Dạ đây là báo giá cho anh/chị ạ 📋\n\n${lines}\n\nTổng cộng: ${Math.round(quote.total).toLocaleString('vi-VN')}đ\n\nAnh/chị xem giúp em, cần điều chỉnh gì thì nhắn lại nha ạ!`;

  // Enqueue tin nhắn thật gửi qua Zalo — cùng bảng outbound_messages mà
  // zEnterprise Inbox đã dùng, backend outbound/sender.js đang poll sẵn
  await query(
    `INSERT INTO outbound_messages (thread_id, is_direct, text) VALUES ($1, true, $2)`,
    [quote.customer_uid, text]
  );

  await query(
    `UPDATE quote_negotiations SET status = 'sent_to_customer', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return getQuote(id);
}

// Tra cứu bảng giá (giống catalog dùng cho khách chat) để AI Sales-negotiation
// đề xuất điều chỉnh trong đúng biên độ giá thật, không bịa giá
export async function listCatalogPrices(): Promise<{ product_name: string; unit: string; unit_price: number }[]> {
  return query(
    `SELECT product_name, unit, unit_price FROM product_prices WHERE active ORDER BY product_name, unit_price`
  );
}

export interface AgriDemoMetrics {
  catalogProductCount: number;
  conversationCount: number;
  aiAnsweredRate: number | null; // % — null nếu chưa có dữ liệu
  avgLatencyMs: number | null;
  quotesSentCount: number;
  totalQuotedValue: number;
}

// Chỉ số riêng cho demo ngành nông dược — hiển thị đầu trang Quote Desk để
// khách xem demo thấy ngay quy mô/độ chính xác/tốc độ của AI (không phải số
// giả — tính trực tiếp từ ai_logs/messages/quote_negotiations của (các) UID
// khách demo cấu hình trong settings.demo_customer_uids)
export async function getAgriDemoMetrics(): Promise<AgriDemoMetrics> {
  const empty: AgriDemoMetrics = {
    catalogProductCount: 0, conversationCount: 0, aiAnsweredRate: null,
    avgLatencyMs: null, quotesSentCount: 0, totalQuotedValue: 0,
  };
  try {
    const [{ value: demoUidsRaw } = { value: '' }] = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'demo_customer_uids'`
    );
    const demoUids = (demoUidsRaw ?? '').split(',').map(s => s.trim()).filter(Boolean);

    const [catalog] = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT product_name) AS count FROM product_prices WHERE active`
    );
    const [quoteAgg] = await query<{ sent_count: string; total_value: string | null }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent_to_customer') AS sent_count,
              COALESCE(SUM(total) FILTER (WHERE status = 'sent_to_customer'), 0) AS total_value
       FROM quote_negotiations`
    ).catch(() => [{ sent_count: '0', total_value: '0' }]) as any;

    if (demoUids.length === 0) {
      return {
        ...empty,
        catalogProductCount: Number(catalog?.count ?? 0),
        quotesSentCount: Number(quoteAgg?.sent_count ?? 0),
        totalQuotedValue: Number(quoteAgg?.total_value ?? 0),
      };
    }

    const [convo] = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages WHERE msg_type = 'text' AND (sender_uid = ANY($1) OR group_id = ANY($1))`,
      [demoUids]
    );
    const [aiAgg] = await query<{ answered_rate: string | null; avg_latency: string | null }>(
      `SELECT ROUND(AVG(is_answered::int) * 100) AS answered_rate, ROUND(AVG(latency_ms)) AS avg_latency
       FROM ai_logs WHERE sender_uid = ANY($1)`,
      [demoUids]
    );

    return {
      catalogProductCount: Number(catalog?.count ?? 0),
      conversationCount: Number(convo?.count ?? 0),
      aiAnsweredRate: aiAgg?.answered_rate != null ? Number(aiAgg.answered_rate) : null,
      avgLatencyMs: aiAgg?.avg_latency != null ? Number(aiAgg.avg_latency) : null,
      quotesSentCount: Number(quoteAgg?.sent_count ?? 0),
      totalQuotedValue: Number(quoteAgg?.total_value ?? 0),
    };
  } catch {
    return empty;
  }
}
