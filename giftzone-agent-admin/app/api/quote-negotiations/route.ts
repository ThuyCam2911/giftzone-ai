import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { listActiveQuotes } from '@/lib/queries/quote-negotiations';

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const quotes = await listActiveQuotes();
  return NextResponse.json({ quotes });
}
