import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const rows = await query<{ file_name: string; chunks: string; last_indexed: string }>(
    `SELECT file_name,
            COUNT(*) AS chunks,
            MAX(indexed_at) AS last_indexed
     FROM doc_chunks
     GROUP BY file_name
     ORDER BY file_name`
  );
  return NextResponse.json(rows);
}
