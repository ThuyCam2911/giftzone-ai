import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptSensitive } from '@/lib/crypto';

const VALID_ROLES = ['sales', 'cs', 'manager', 'technical'];
const VALID_STATUS = ['active', 'inactive'];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: {
    account_name?: string; email?: string; password?: string; branch?: string;
    role?: string; status?: string; linked_sender_uid?: string | null;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const account_name = (body.account_name ?? '').trim();
  if (!account_name) return NextResponse.json({ error: 'account_name is required' }, { status: 400 });

  const role = VALID_ROLES.includes(body.role ?? '') ? body.role : 'sales';
  const status = VALID_STATUS.includes(body.status ?? '') ? body.status : 'active';
  // Mật khẩu để trống khi sửa = giữ nguyên giá trị cũ, không ghi đè
  const password = (body.password ?? '').trim();

  if (password) {
    await query(
      `UPDATE zenterprise_accounts
       SET account_name=$1, email=$2, password_enc=$3, branch=$4, role=$5, status=$6, linked_sender_uid=$7, updated_at=NOW()
       WHERE id=$8`,
      [account_name, body.email?.trim() || null, encryptSensitive(password), body.branch ?? null, role, status, body.linked_sender_uid || null, id],
    );
  } else {
    await query(
      `UPDATE zenterprise_accounts
       SET account_name=$1, email=$2, branch=$3, role=$4, status=$5, linked_sender_uid=$6, updated_at=NOW()
       WHERE id=$7`,
      [account_name, body.email?.trim() || null, body.branch ?? null, role, status, body.linked_sender_uid || null, id],
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await query(`DELETE FROM zenterprise_accounts WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
