import { query } from '@/lib/db';

// Kho nội dung SEED cho các trang "Master Layer" demo (Dashboard/Hệ thống
// nghiệp vụ/Report & Insight) — dữ liệu minh hoạ cho buổi quay demo, KHÔNG
// phải số liệu tính toán thật từ AgriDMS/Loyalty/CRM (những hệ thống này chưa
// tồn tại). Dùng 1 bảng JSONB linh hoạt thay vì nhiều bảng cứng nhắc vì mỗi
// "block" (KPI card, insight box, chart, report card...) có hình dạng khác nhau.
export type BlockPage = 'dashboard' | 'agridms' | 'loyalty' | 'crm' | 'report';
export type BlockSection = 'kpi' | 'alert' | 'chart' | 'insight' | 'activity' | 'list' | 'report_card';

export interface ContentBlock<T = any> {
  id: number;
  page: BlockPage;
  section: BlockSection;
  sort_order: number;
  data: T;
}

export async function ensureContentBlocksTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS demo_content_blocks (
      id         SERIAL PRIMARY KEY,
      page       TEXT NOT NULL,
      section    TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function getBlocks<T = any>(page: BlockPage, section?: BlockSection): Promise<ContentBlock<T>[]> {
  await ensureContentBlocksTable();
  const rows = section
    ? await query<ContentBlock<T>>(
        `SELECT id, page, section, sort_order, data FROM demo_content_blocks WHERE page = $1 AND section = $2 ORDER BY sort_order ASC`,
        [page, section],
      )
    : await query<ContentBlock<T>>(
        `SELECT id, page, section, sort_order, data FROM demo_content_blocks WHERE page = $1 ORDER BY section, sort_order ASC`,
        [page],
      );
  return rows.map(r => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data as any) : r.data }));
}

export async function replacePageBlocks(page: BlockPage, blocks: { section: BlockSection; sort_order: number; data: any }[]) {
  await ensureContentBlocksTable();
  await query(`DELETE FROM demo_content_blocks WHERE page = $1`, [page]);
  for (const b of blocks) {
    await query(
      `INSERT INTO demo_content_blocks (page, section, sort_order, data) VALUES ($1, $2, $3, $4)`,
      [page, b.section, b.sort_order, JSON.stringify(b.data)],
    );
  }
}
