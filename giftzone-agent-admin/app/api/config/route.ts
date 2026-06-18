import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const rows = await query<{ key: string; value: string; description: string; updated_at: string }>(
    `SELECT key, value, description, updated_at FROM settings ORDER BY key`
  );
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key và value là bắt buộc' }, { status: 400 });
  }
  await query(
    `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`,
    [String(value), key]
  );
  return NextResponse.json({ ok: true });
}
