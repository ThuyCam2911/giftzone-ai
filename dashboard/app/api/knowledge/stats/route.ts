import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const [topQuestions, unanswered, docUsage] = await Promise.all([
    query<{ question: string; count: string }>(
      `SELECT query AS question, COUNT(*) AS count
       FROM ai_logs
       GROUP BY query
       ORDER BY count DESC
       LIMIT 8`
    ),
    query<{ question: string; count: string }>(
      `SELECT query AS question, COUNT(*) AS count
       FROM ai_logs
       WHERE answer ILIKE '%chưa có thông tin%'
       GROUP BY query
       ORDER BY count DESC
       LIMIT 6`
    ),
    query<{ file_name: string; count: string }>(
      `SELECT src AS file_name, COUNT(*) AS count
       FROM ai_logs, jsonb_array_elements_text(sources) AS src
       GROUP BY src
       ORDER BY count DESC
       LIMIT 6`
    ),
  ]);

  return NextResponse.json({ topQuestions, unanswered, docUsage });
}
