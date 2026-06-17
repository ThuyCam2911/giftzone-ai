import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!verifyPassword(password)) {
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
