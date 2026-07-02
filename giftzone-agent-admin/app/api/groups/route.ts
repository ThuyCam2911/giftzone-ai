import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest) {
  const { group_id, group_type } = await req.json();
  if (!group_id || !['customer', 'internal', 'unknown'].includes(group_type)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  await query(
    `INSERT INTO group_names (group_id, name, group_type, updated_at)
     VALUES ($1, $1, $2, NOW())
     ON CONFLICT (group_id) DO UPDATE SET group_type = $2, updated_at = NOW()`,
    [group_id, group_type]
  );
  return NextResponse.json({ ok: true });
}
