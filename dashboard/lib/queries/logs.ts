import { query } from '@/lib/db';
import type { LogRow } from '@/types';

const PAGE_SIZE = 20;

export interface LogsResult {
  rows: LogRow[];
  total: number;
  totalPages: number;
}

export async function getLogs(page = 1): Promise<LogsResult> {
  const offset = (page - 1) * PAGE_SIZE;
  const [rows, total] = await Promise.all([
    query<LogRow>(
      `SELECT l.id, l.group_id, gn.name AS group_name, l.query, l.answer,
              l.sources, l.latency_ms, l.created_at
       FROM ai_logs l
       LEFT JOIN group_names gn ON gn.group_id = l.group_id
       ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset],
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM ai_logs`),
  ]);
  const totalCount = Number(total[0]?.count ?? 0);
  return { rows, total: totalCount, totalPages: Math.ceil(totalCount / PAGE_SIZE) };
}
