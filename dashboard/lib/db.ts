import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const config = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host:     process.env.PG_HOST     ?? 'localhost',
          port:     Number(process.env.PG_PORT ?? 5433),
          database: process.env.PG_DATABASE ?? 'giftzone_agent',
          user:     process.env.PG_USER     ?? 'postgres',
          password: process.env.PG_PASSWORD ?? 'postgres',
        };
    pool = new Pool(config);
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}
