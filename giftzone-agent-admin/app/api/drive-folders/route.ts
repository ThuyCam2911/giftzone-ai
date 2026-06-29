import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS drive_folders (
      id         SERIAL PRIMARY KEY,
      folder_id  TEXT NOT NULL UNIQUE,
      note       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureTable();
  const rows = await query<{ id: number; folder_id: string; note: string; created_at: string }>(
    `SELECT id, folder_id, note, created_at FROM drive_folders ORDER BY created_at ASC`,
  );
  return NextResponse.json({ folders: rows });
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { folder_id?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const folder_id = (body.folder_id ?? '').trim();
  const note      = (body.note ?? '').trim();
  if (!folder_id) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 });

  await ensureTable();
  const rows = await query<{ id: number; folder_id: string; note: string; created_at: string }>(
    `INSERT INTO drive_folders (folder_id, note)
     VALUES ($1, $2)
     ON CONFLICT (folder_id) DO UPDATE SET note = $2
     RETURNING id, folder_id, note, created_at`,
    [folder_id, note],
  );
  return NextResponse.json({ folder: rows[0] });
}
