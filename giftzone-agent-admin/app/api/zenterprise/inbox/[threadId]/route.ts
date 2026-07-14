import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getThreadMessages, setAiPaused, enqueueOutboundMessage } from '@/lib/queries/zenterprise-inbox';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { threadId } = await params;
  const messages = await getThreadMessages(threadId);
  return NextResponse.json({ messages });
}

// Bật/tắt AI cho hội thoại này — dùng khi nhân viên muốn tự trả lời tay
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { threadId } = await params;
  const { ai_paused } = await req.json();
  if (typeof ai_paused !== 'boolean') return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  await setAiPaused(threadId, ai_paused, 'dashboard');
  return NextResponse.json({ ok: true });
}

// Xếp hàng gửi tin nhắn Zalo thật — backend poll bảng outbound_messages và gửi
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { threadId } = await params;
  const { text } = await req.json();
  const trimmed = (text ?? '').trim();
  if (!trimmed) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  const id = await enqueueOutboundMessage(threadId, trimmed);
  return NextResponse.json({ ok: true, id });
}
