import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import { encryptSensitive } from '@/lib/crypto';

const SENSITIVE_PREFIX = 'zalo_cookie';

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await query<{ key: string; value: string; description: string; updated_at: string }>(
    `SELECT key, value, description, updated_at FROM settings ORDER BY key`
  );
  // Cookie không bao giờ trả về thật (kể cả ciphertext) — browser chỉ thấy có/không có giá trị
  const masked = rows.map(r =>
    r.key.startsWith(SENSITIVE_PREFIX) ? { ...r, value: r.value ? '••••••••••••' : '' } : r
  );
  return NextResponse.json(masked);
}

export async function PUT(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key và value là bắt buộc' }, { status: 400 });
  }

  // Không cho phép ghi đè cookie bằng chính giá trị mask đã trả về ở GET
  if (key.startsWith(SENSITIVE_PREFIX) && /^•+$/.test(String(value))) {
    return NextResponse.json({ error: 'Giá trị chưa thay đổi' }, { status: 400 });
  }

  const stored = key.startsWith(SENSITIVE_PREFIX) ? encryptSensitive(String(value)) : String(value);
  await query(
    `INSERT INTO settings (key, value, description, updated_at)
     VALUES ($2, $1, '', NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [stored, key]
  );
  return NextResponse.json({ ok: true });
}
