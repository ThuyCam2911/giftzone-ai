import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const config = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          // Serverless (Vercel): mỗi lambda instance mở 1 pool riêng — giữ max thấp +
          // giải phóng connection nhàn rỗi nhanh để không tồn đọng session trên Supabase
          // Session Pooler (free tier giới hạn cứng 15 kết nối, 2 backend VPS đã chiếm tới 10)
          max: 1,
          idleTimeoutMillis: 5000,
          connectionTimeoutMillis: 10000,
          allowExitOnIdle: true,
        }
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
