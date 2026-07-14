import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { listInboxThreads } from '@/lib/queries/zenterprise-inbox';

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const threads = await listInboxThreads();
  return NextResponse.json({ threads });
}
