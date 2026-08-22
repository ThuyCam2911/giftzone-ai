import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getQuote, getQuoteMessages, approveQuote } from '@/lib/queries/quote-negotiations';
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

// Sales bấm "Duyệt & gửi khách" — enqueue tin nhắn Zalo thật qua outbound_messages
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'approve') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const quote = await approveQuote(id);
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, quote });
}
