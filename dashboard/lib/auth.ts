import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

export const COOKIE_NAME = 'gz_session';

function makeToken(password: string): string {
  const secret = process.env.SESSION_SECRET ?? 'secret';
  return createHmac('sha256', secret).update(password).digest('hex');
}

export function verifyPassword(password: string): boolean {
  return password === process.env.DASHBOARD_PASSWORD;
}

export function generateToken(password: string): string {
  return makeToken(password);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = makeToken(process.env.DASHBOARD_PASSWORD ?? '');
  return token === expected;
}
