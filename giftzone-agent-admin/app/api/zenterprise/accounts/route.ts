import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptSensitive } from '@/lib/crypto';
import { ensureZEnterpriseTable, listZEnterpriseAccounts, listLinkCandidates } from '@/lib/queries/zenterprise';

const VALID_ROLES = ['sales', 'cs', 'manager', 'technical'];
const VALID_STATUS = ['active', 'inactive'];

export async function GET() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [accounts, candidates] = await Promise.all([
    listZEnterpriseAccounts(),
    listLinkCandidates(),
  ]);
  return NextResponse.json({ accounts, candidates });
}

export async function POST(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    account_name?: string; email?: string; password?: string; branch?: string;
    role?: string; status?: string; linked_sender_uid?: string | null;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const account_name = (body.account_name ?? '').trim();
  if (!account_name) return NextResponse.json({ error: 'account_name is required' }, { status: 400 });

  const role = VALID_ROLES.includes(body.role ?? '') ? body.role : 'sales';
  const status = VALID_STATUS.includes(body.status ?? '') ? body.status : 'active';
  const password = (body.password ?? '').trim();
  const password_enc = password ? encryptSensitive(password) : null;

  await ensureZEnterpriseTable();
  const rows = await query<{ id: number }>(
    `INSERT INTO zenterprise_accounts (account_name, email, password_enc, branch, role, status, linked_sender_uid)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [account_name, body.email?.trim() || null, password_enc, body.branch ?? null, role, status, body.linked_sender_uid || null],
  );
  return NextResponse.json({ ok: true, id: rows[0]?.id });
}
