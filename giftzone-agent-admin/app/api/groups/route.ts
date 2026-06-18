import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest) {
  const { group_id, group_type } = await req.json();
  if (!group_id || !['customer', 'internal', 'unknown'].includes(group_type)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  await query(
    `UPDATE group_names SET group_type = $1, updated_at = NOW() WHERE group_id = $2`,
    [group_type, group_id]
  );
  return NextResponse.json({ ok: true });
}
