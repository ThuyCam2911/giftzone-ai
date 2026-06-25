import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const issueId = Number(id);
  if (!Number.isFinite(issueId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { status?: string };
  try { body = await req.json(); } catch { body = {}; }

  const status = body.status ?? 'resolved';
  if (!['resolved', 'open'].includes(status)) {
    return NextResponse.json({ error: 'status must be resolved or open' }, { status: 400 });
  }

  await query(
    `UPDATE sales_issues
     SET status=$1, resolved_at=CASE WHEN $1='resolved' THEN NOW() ELSE NULL END, updated_at=NOW()
     WHERE id=$2`,
    [status, issueId],
  );

  return NextResponse.json({ ok: true });
}
