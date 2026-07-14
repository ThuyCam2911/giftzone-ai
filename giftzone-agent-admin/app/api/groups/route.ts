import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { group_id, group_type, branch } = await req.json();

  if (branch !== undefined) {
    if (!group_id) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    await query(
      `UPDATE group_names SET branch = $2, updated_at = NOW() WHERE group_id = $1`,
      [group_id, (branch as string).trim() || null],
    );
    return NextResponse.json({ ok: true });
  }

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
