/**
 * Seed bảng giá DEMO cho 8 sản phẩm Nông Dược đã có sẵn trong doc_chunks
 * (xem tên/quy cách trong các file "*.txt" đã index từ Google Drive).
 *
 * ⚠️ GIÁ LÀ SỐ DEMO — chưa phải giá bán thật, cần thay bằng giá thật trước khi
 * dùng báo giá chính thức cho khách (sửa trực tiếp trong bảng product_prices).
 *
 * Chạy: npm run seed:prices
 */
import 'dotenv/config';
import { query, initSchema } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('SeedPrices');

// product_name PHẢI khớp tên sản phẩm dùng trong doc_chunks/tin nhắn để Ops
// Assistant match đúng khi Sales @mention hỏi báo giá
const DEMO_PRICES = [
  { product: 'Antracol 70WP', unit: 'gói 100g', price: 25000 },
  { product: 'Antracol 70WP', unit: 'gói 500g', price: 105000 },
  { product: 'Antracol 70WP', unit: 'bao 1kg', price: 195000 },

  { product: 'Anvil 5SC', unit: 'chai 100ml', price: 45000 },
  { product: 'Anvil 5SC', unit: 'chai 250ml', price: 98000 },
  { product: 'Anvil 5SC', unit: 'can 1 lít', price: 340000 },

  { product: 'Confidor 100SL', unit: 'chai 100ml', price: 65000 },
  { product: 'Confidor 100SL', unit: 'chai 500ml', price: 290000 },
  { product: 'Confidor 100SL', unit: 'can 1 lít', price: 540000 },

  { product: 'Glyphosate 41SL', unit: 'can 1 lít', price: 85000 },
  { product: 'Glyphosate 41SL', unit: 'can 5 lít', price: 390000 },

  { product: 'Growmore 30-10-10', unit: 'gói 100g', price: 20000 },
  { product: 'Growmore 30-10-10', unit: 'gói 500g', price: 85000 },
  { product: 'Growmore 30-10-10', unit: 'bao 1kg', price: 155000 },

  { product: 'Sofit 300EC', unit: 'chai 500ml', price: 110000 },
  { product: 'Sofit 300EC', unit: 'can 1 lít', price: 205000 },

  { product: 'Vitoxin 1.8SL', unit: 'chai 100ml', price: 30000 },
  { product: 'Vitoxin 1.8SL', unit: 'chai 250ml', price: 65000 },
  { product: 'Vitoxin 1.8SL', unit: 'chai 500ml', price: 115000 },

  { product: 'Whip S 7.5EW', unit: 'chai 100ml', price: 55000 },
  { product: 'Whip S 7.5EW', unit: 'chai 480ml', price: 240000 },
];

async function seed() {
  await initSchema();
  for (const { product, unit, price } of DEMO_PRICES) {
    await query(
      `INSERT INTO product_prices (product_name, unit, unit_price)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_name, unit) DO UPDATE SET unit_price = $3, updated_at = NOW()`,
      [product, unit, price]
    );
  }
  log.info(`Đã seed ${DEMO_PRICES.length} dòng giá DEMO cho ${new Set(DEMO_PRICES.map(p => p.product)).size} sản phẩm ✓`);
}

if (process.argv[1]?.endsWith('seed-product-prices.js')) {
  await seed();
  process.exit(0);
}

export { seed };
