import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getQuote, getQuoteMessages, approveQuote, manualUpdateItems, sendReminder, type QuoteItem } from '@/lib/queries/quote-negotiations';
import { getThreadMessages } from '@/lib/queries/zenterprise-inbox';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const quote = await getQuote(id);
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [messages, customerMessages] = await Promise.all([
    getQuoteMessages(id),
    getThreadMessages(quote.customer_uid),
  ]);

  return NextResponse.json({ quote, messages, customerMessages });
}

function isValidItems(items: unknown): items is QuoteItem[] {
  return Array.isArray(items) && items.every(it =>
    it && typeof it.product_name === 'string' && typeof it.unit === 'string' &&
    Number.isFinite(Number(it.unit_price)) && Number.isFinite(Number(it.qty))
  );
}

// action: 'approve' — duyệt & gửi khách qua Zalo
// action: 'update_items' — Sales tự sửa tay từng dòng trên form (không qua AI)
// action: 'remind' — nhắc khách bổ sung thông tin còn thiếu
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));

  if (body.action === 'approve') {
    const quote = await approveQuote(id);
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, quote });
  }

  if (body.action === 'update_items') {
    if (!isValidItems(body.items)) return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    await manualUpdateItems(id, body.items.map((it: any) => ({
      product_name: String(it.product_name), unit: String(it.unit),
      unit_price: Number(it.unit_price), qty: Number(it.qty),
    })));
    const quote = await getQuote(id);
    return NextResponse.json({ ok: true, quote });
  }

  if (body.action === 'remind') {
    const missingText = String(body.missingText ?? '').trim() || 'sản phẩm cụ thể và số lượng cần dùng';
    const quote = await sendReminder(id, missingText);
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, quote });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
