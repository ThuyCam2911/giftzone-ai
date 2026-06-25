import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gz_members (
      sender_uid  TEXT PRIMARY KEY,
      sender_name TEXT NOT NULL,
      added_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE gz_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'sales'`);
}

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureTable();

  const [saved, candidates] = await Promise.all([
    query<{ sender_uid: string; sender_name: string; role: string }>(
      `SELECT sender_uid, sender_name, role FROM gz_members ORDER BY sender_name`,
    ),
    query<{ sender_uid: string; sender_name: string; msg_count: number }>(
      `SELECT m.sender_uid, MAX(m.sender_name) AS sender_name, COUNT(*) AS msg_count
       FROM messages m
       LEFT JOIN group_names gn ON gn.group_id = m.group_id
       WHERE COALESCE(gn.group_type, 'customer') != 'internal'
         AND m.sender_uid IS NOT NULL AND m.sender_name IS NOT NULL
       GROUP BY m.sender_uid
       ORDER BY msg_count DESC
       LIMIT 50`,
    ),
  ]);

  return NextResponse.json({ saved, candidates });
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { members?: { sender_uid: string; sender_name: string; role?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { members } = body;
  if (!Array.isArray(members)) {
    return NextResponse.json({ error: 'members must be an array' }, { status: 400 });
  }

  const valid = members.filter(m => m.sender_uid && m.sender_name);

  await ensureTable();
  await query(`DELETE FROM gz_members`);

  if (valid.length > 0) {
    const values = valid
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(', ');
    const params = valid.flatMap(m => [m.sender_uid, m.sender_name, m.role ?? 'sales']);
    await query(
      `INSERT INTO gz_members (sender_uid, sender_name, role) VALUES ${values}
       ON CONFLICT (sender_uid) DO UPDATE SET sender_name = EXCLUDED.sender_name, role = EXCLUDED.role`,
      params,
    );
  }

  return NextResponse.json({ ok: true, count: valid.length });
}
