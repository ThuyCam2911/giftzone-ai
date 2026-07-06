import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateToken, COOKIE_NAME } from '@/lib/auth';
import { query } from '@/lib/db';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 10;

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS login_attempts (
    id         BIGSERIAL PRIMARY KEY,
    ip         TEXT NOT NULL,
    success    BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

function getClientIp(req: NextRequest): string {
  // Vercel/proxy set x-forwarded-for; đây là Vercel-hosted nên tin header này
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const ip = getClientIp(req);

  const recentFailures = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM login_attempts
     WHERE ip = $1 AND success = false AND created_at >= NOW() - ($2 || ' minutes')::INTERVAL`,
    [ip, WINDOW_MINUTES]
  );
  if (Number(recentFailures[0]?.count ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `Quá nhiều lần thử sai. Vui lòng đợi ${WINDOW_MINUTES} phút rồi thử lại.` },
      { status: 429 },
    );
  }

  const { password } = await req.json();
  const ok = verifyPassword(password);
  await query(`INSERT INTO login_attempts (ip, success) VALUES ($1, $2)`, [ip, ok]);

  if (!ok) {
    return NextResponse.json({ error: 'Sai mật khẩu' }, { status: 401 });
  }

  const token = generateToken(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 ngày
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
