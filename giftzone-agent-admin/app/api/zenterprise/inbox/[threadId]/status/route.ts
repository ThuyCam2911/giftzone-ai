import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getOutboundStatus } from '@/lib/queries/zenterprise-inbox';

export async function GET(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const idsParam = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').map(s => Number(s)).filter(n => Number.isFinite(n));
  const statuses = await getOutboundStatus(ids);
  return NextResponse.json({ statuses });
}
