import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page     = Math.max(1, Number(searchParams.get('page') ?? 1));
  const groupId  = searchParams.get('group_id') ?? '';
  const date     = searchParams.get('date') ?? '';
  const limit    = 20;
  const offset   = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (groupId) {
    params.push(groupId);
    conditions.push(`group_id = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`created_at::date = $${params.length}::date`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, total] = await Promise.all([
    query<{
      id: number; group_id: string; sender_uid: string;
      query: string; answer: string; sources: string[];
      latency_ms: number; created_at: string;
    }>(
      `SELECT id, group_id, sender_uid, query, answer, sources, latency_ms, created_at
       FROM ai_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ai_logs ${where}`,
      params
    ),
  ]);

  return NextResponse.json({
    rows,
    total:    Number(total[0]?.count ?? 0),
    page,
    totalPages: Math.ceil(Number(total[0]?.count ?? 0) / limit),
  });
}
