/**
 * Seed catalog nông dược/thuốc BVTV cho demo showoff (nhánh ai-for-demo).
 *
 * Bối cảnh: "Nông Dược Đồng Xanh" — nhà phân phối cấp 1 khu vực An Giang –
 * Đồng Tháp, cùng vùng với Lộc Trời (Tập đoàn nông nghiệp lớn nhất khu vực
 * ĐBSCL, trụ sở An Giang) — khớp với vùng ASM trong các trang demo khác.
 *
 * ⚠️ Phân tách rõ 2 loại dữ liệu:
 * - Tên sản phẩm, hoạt chất, đối tượng phòng trừ, liều dùng: DỮ LIỆU THẬT,
 *   đang lưu hành hợp pháp tại Việt Nam theo Thông tư 25/2024/TT-BNNPTNT
 *   (Cục Bảo vệ Thực vật, Bộ NN&PTNT) — nguồn: trang sản phẩm chính thức của
 *   Syngenta VN / Bayer CropScience VN / Corteva VN và tài liệu khuyến nông.
 *   KHÔNG bao gồm hoạt chất đã bị cấm (Paraquat, Carbofuran, Methyl Parathion...).
 * - Quy cách đóng gói và GIÁ: DỮ LIỆU GIẢ LẬP cho mục đích ghi hình demo (giá
 *   phân phối thật là thông tin thương mại không công khai) — không dùng làm
 *   căn cứ báo giá/mua bán thật.
 * - Thời gian cách ly/lưu ý an toàn: chỉ ghi khi có số liệu xác nhận được;
 *   còn lại ghi "theo khuyến cáo trên nhãn thuốc" thay vì tự suy đoán.
 *
 * Mỗi sản phẩm được:
 * 1. Ghi thành 1 đoạn văn mô tả đầy đủ → embed + insert vào doc_chunks (giống
 *    hệt cách indexer.js làm với file Drive thật) để RAG (retriever.js) trả
 *    lời được các câu hỏi phức tạp/so sánh sản phẩm.
 * 2. Seed giá vào product_prices (bảng quote/generator.js đã dùng) — CÙNG 1
 *    nguồn giá cho cả câu trả lời chat lẫn báo giá cấu trúc, tránh lệch số.
 *
 * Chạy: npm run seed:agri-catalog
 */
import 'dotenv/config';
import { embed } from '../rag/embedder.js';
import { query, initSchema } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('SeedAgriCatalog');

const FILE_ID = 'demo-agri-catalog';
const FILE_NAME = 'agri-catalog-demo.md';

const CATALOG = [
  // ── Thuốc trừ sâu ──────────────────────────────────────────────────────────
  {
    name: 'Actara 25WG', group: 'Thuốc trừ sâu', activeIngredient: 'Thiamethoxam 250g/kg', manufacturer: 'Syngenta',
    targets: 'Rầy nâu, rầy lưng trắng, bọ trĩ trên lúa và rau màu',
    dosage: '20g/bình 25 lít, thuốc nội hấp (systemic) nên hiệu lực kéo dài',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'gói 20g', price: 22000 }, { unit: 'gói 100g', price: 95000 }],
  },
  {
    name: 'Virtako 40WG', group: 'Thuốc trừ sâu', activeIngredient: 'Chlorantraniliprole 200g/kg + Thiamethoxam 200g/kg', manufacturer: 'Syngenta',
    targets: 'Sâu cuốn lá, sâu đục thân, rầy nâu trên lúa',
    dosage: '15–20g/bình 16 lít (75–100g/ha)',
    phi: '14 ngày', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'gói 15g', price: 28000 }, { unit: 'gói 100g', price: 175000 }],
  },
  {
    name: 'Karate 2.5EC', group: 'Thuốc trừ sâu', activeIngredient: 'Lambda-cyhalothrin 25g/l', manufacturer: 'Syngenta',
    targets: 'Sâu cuốn lá, rầy nâu, bọ xít muỗi, bọ trĩ trên lúa và rau',
    dosage: '10–20ml/bình 16 lít, tiếp xúc + vị độc, hiệu lực nhanh',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 38000 }, { unit: 'chai 500ml', price: 165000 }],
  },
  {
    name: 'Chess 50WG', group: 'Thuốc trừ sâu', activeIngredient: 'Pymetrozine 500g/kg', manufacturer: 'Syngenta',
    targets: 'Rầy nâu, rầy lưng trắng trên lúa',
    dosage: '25g/bình 16 lít (0.15–0.2kg/ha) — cơ chế ngưng chích hút ngay, không kháng chéo với nhóm neonicotinoid',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'gói 25g', price: 20000 }, { unit: 'gói 100g', price: 72000 }],
  },
  {
    name: 'Regent 800WG', group: 'Thuốc trừ sâu', activeIngredient: 'Fipronil 800g/kg', manufacturer: 'Bayer CropScience',
    targets: 'Sâu cuốn lá, nhện gié, bọ trĩ trên lúa',
    dosage: '1.6g/bình 16 lít, phun 2 bình/1.000m²',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'gói 8g', price: 15000 }, { unit: 'gói 100g', price: 160000 }],
  },
  {
    name: 'Confidor 200SL', group: 'Thuốc trừ sâu', activeIngredient: 'Imidacloprid 200g/l', manufacturer: 'Bayer CropScience',
    targets: 'Rầy, bọ trĩ, rệp sáp, bù lạch trên lúa, rau, cây ăn quả',
    dosage: '10–20ml/bình 16 lít, thuốc nội hấp, dùng được cả phun lá và xử lý đất',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 65000 }, { unit: 'chai 500ml', price: 290000 }],
  },
  {
    name: 'Mospilan 3EC', group: 'Thuốc trừ sâu', activeIngredient: 'Acetamiprid 30g/l', manufacturer: 'Nippon Soda',
    targets: 'Rầy nâu, bọ trĩ trên lúa và rau',
    dosage: '15–20ml/bình 16 lít',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 45000 }, { unit: 'chai 500ml', price: 195000 }],
  },
  {
    name: 'Padan 95SP', group: 'Thuốc trừ sâu', activeIngredient: 'Cartap hydrochloride 950g/kg', manufacturer: 'UPL',
    targets: 'Sâu cuốn lá, sâu đục thân trên lúa',
    dosage: '15g/bình 16 lít (0.3–0.5kg/ha)',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'gói 100g', price: 25000 }, { unit: 'bao 1kg', price: 210000 }],
  },
  // ── Thuốc trừ bệnh ─────────────────────────────────────────────────────────
  {
    name: 'Amistar Top 325SC', group: 'Thuốc trừ bệnh', activeIngredient: 'Azoxystrobin 200g/l + Difenoconazole 125g/l', manufacturer: 'Syngenta',
    targets: 'Đốm vằn, lem lép hạt, vàng lá chín sớm trên lúa, cà phê, cao su',
    dosage: '15–20ml/bình 25 lít — giữ xanh 3 lá trên cùng, kéo dài thời gian quang hợp',
    phi: '5–10 ngày', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 68000 }, { unit: 'chai 500ml', price: 305000 }],
  },
  {
    name: 'Tilt Super 300EC', group: 'Thuốc trừ bệnh', activeIngredient: 'Propiconazole 150g/l + Difenoconazole 150g/l', manufacturer: 'Syngenta',
    targets: 'Lem lép hạt, đốm vằn (khô vằn), vàng lá trên lúa, cà phê, cao su',
    dosage: '15–20ml/bình 25 lít',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 42000 }, { unit: 'chai 500ml', price: 185000 }],
  },
  {
    name: 'Beam 75WP', group: 'Thuốc trừ bệnh', activeIngredient: 'Tricyclazole 750g/kg', manufacturer: 'Corteva',
    targets: 'Đạo ôn lá và đạo ôn cổ bông trên lúa (Magnaporthe oryzae)',
    dosage: '40–75g/ha, phun phòng khi lúa 30–35 ngày và trước trổ 5–7 ngày',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'gói 100g', price: 30000 }, { unit: 'gói 500g', price: 135000 }],
  },
  {
    name: 'Fuji-One 40EC', group: 'Thuốc trừ bệnh', activeIngredient: 'Isoprothiolane 400g/l', manufacturer: 'Nichino (Nihon Nohyaku)',
    targets: 'Đạo ôn lá và đạo ôn cổ bông trên lúa',
    dosage: '40–50ml/bình 16 lít (1.0–1.2 lít/ha)',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 40000 }, { unit: 'chai 480ml', price: 172000 }],
  },
  {
    name: 'Validacin 3SL', group: 'Thuốc trừ bệnh', activeIngredient: 'Validamycin A 30g/l (nguồn gốc sinh học/lên men)', manufacturer: 'Đa nhà đăng ký tại VN',
    targets: 'Đốm vằn (Rhizoctonia solani) trên lúa',
    dosage: '60–80ml/bình 16 lít',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 240ml', price: 35000 }, { unit: 'chai 1 lít', price: 130000 }],
  },
  {
    name: 'Anvil 5SC', group: 'Thuốc trừ bệnh', activeIngredient: 'Hexaconazole 50g/l', manufacturer: 'Syngenta',
    targets: 'Đốm vằn, đạo ôn trên lúa và cây công nghiệp',
    dosage: '20–25ml/bình 16 lít, thuốc nội hấp phổ rộng',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 100ml', price: 45000 }, { unit: 'chai 500ml', price: 200000 }],
  },
  // ── Thuốc trừ cỏ ───────────────────────────────────────────────────────────
  {
    name: 'Sofit 300EC', group: 'Thuốc trừ cỏ', activeIngredient: 'Pretilachlor 300g/l + Fenclorim 100g/l (chất an toàn)', manufacturer: 'Syngenta',
    targets: 'Cỏ mầm, lúa cỏ (Echinochloa, Leptochloa), cỏ lá rộng — tiền nảy mầm trên lúa sạ',
    dosage: '25–30ml/bình 8 lít, phun trong vòng 0–4 ngày sau sạ — chất an toàn Fenclorim bảo vệ mộng lúa',
    phi: 'Không áp dụng (xử lý tiền nảy mầm)', compat: 'Không phun trễ hơn khuyến cáo trên nhãn — mộng lúa lớn dễ bị ảnh hưởng.',
    units: [{ unit: 'chai 500ml', price: 115000 }, { unit: 'can 1 lít', price: 215000 }],
  },
  {
    name: 'Nominee 10SC', group: 'Thuốc trừ cỏ', activeIngredient: 'Bispyribac-sodium 100g/l', manufacturer: 'Kumiai Chemical / Bayer',
    targets: 'Cỏ lồng vực, đuôi phụng, cỏ chác, cỏ lá rộng — hậu nảy mầm trên lúa sạ',
    dosage: '0.4–0.6 lít/ha, phun 7–20 ngày sau sạ — an toàn cho lúa từ giai đoạn mạ non',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Không phối chung với thuốc trừ sâu gốc dầu trong cùng lượt phun nếu nhãn không khuyến cáo.',
    units: [{ unit: 'chai 240ml', price: 68000 }, { unit: 'chai 1 lít', price: 260000 }],
  },
  {
    name: 'Clincher 10EC', group: 'Thuốc trừ cỏ', activeIngredient: 'Cyhalofop-butyl 100g/l', manufacturer: 'Corteva',
    targets: 'Cỏ hòa thảo (lồng vực, đuôi phụng, lúa cỏ) trên lúa sạ',
    dosage: '0.6–0.8 lít/ha, phun 7–18 ngày sau sạ, pha với 320–400 lít nước/ha',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Tuân thủ hướng dẫn phối trộn trên nhãn, không tự ý phối nhiều loại khi chưa có khuyến cáo.',
    units: [{ unit: 'chai 480ml', price: 105000 }, { unit: 'can 1 lít', price: 210000 }],
  },
  {
    name: 'Whip S 7.5EW', group: 'Thuốc trừ cỏ', activeIngredient: 'Fenoxaprop-P-ethyl (kèm chất an toàn)', manufacturer: 'Bayer CropScience',
    targets: 'Cỏ hòa thảo trên lúa sạ',
    dosage: '0.75–1.0 lít/ha, hậu nảy mầm sớm — thường phối cùng Nominee để phủ cả cỏ hòa thảo và cỏ lác/lá rộng',
    phi: 'Theo khuyến cáo trên nhãn thuốc', compat: 'Thường phối cùng thuốc trừ cỏ lác/lá rộng để mở rộng phổ tác dụng, theo đúng khuyến cáo nhãn.',
    units: [{ unit: 'chai 100ml', price: 55000 }, { unit: 'chai 480ml', price: 235000 }],
  },
  // ── Phân bón lá ────────────────────────────────────────────────────────────
  {
    name: 'Đầu Trâu MK 501 (NPK 30-15-10)', group: 'Phân bón lá', activeIngredient: 'NPK 30-15-10 + vi lượng', manufacturer: 'Bình Điền Mekong',
    targets: 'Thúc chồi, kích ra lá, phục hồi cây sau stress trên lúa, rau, cây ăn quả',
    dosage: '2–3g/1 lít nước, phun định kỳ 7–10 ngày/lần',
    phi: 'Không áp dụng (phân bón lá)', compat: 'Phối được với hầu hết thuốc BVTV, trừ khi nhãn có lưu ý riêng.',
    units: [{ unit: 'gói 100g', price: 18000 }, { unit: 'gói 500g', price: 78000 }],
  },
  {
    name: 'MKP 0-52-34 (Mono Potassium Phosphate)', group: 'Phân bón lá', activeIngredient: 'KH₂PO₄ — P₂O₅ 52%, K₂O 34%', manufacturer: 'Haifa',
    targets: 'Thúc trổ đồng loạt, chắc hạt, tăng trọng lượng hạt trên lúa (giai đoạn trước trổ ~7 ngày)',
    dosage: '50g/8–10 lít nước, phun 2 lần/vụ',
    phi: 'Không áp dụng (phân bón lá)', compat: 'Phối được với hầu hết thuốc BVTV, trừ khi nhãn có lưu ý riêng.',
    units: [{ unit: 'gói 500g', price: 45000 }, { unit: 'bao 1kg', price: 82000 }],
  },
  {
    name: 'Growmore 20-20-20', group: 'Phân bón lá', activeIngredient: 'NPK cân bằng + vi lượng', manufacturer: 'Growmore International',
    targets: 'Dinh dưỡng đa dụng, cân bằng cho nhiều loại cây trồng',
    dosage: '3–5g/1 lít nước, tuỳ giai đoạn sinh trưởng',
    phi: 'Không áp dụng (phân bón lá)', compat: 'Phối được với hầu hết thuốc BVTV, trừ khi nhãn có lưu ý riêng.',
    units: [{ unit: 'gói 100g', price: 20000 }, { unit: 'bao 1kg', price: 155000 }],
  },
  // ── Chất điều hòa sinh trưởng ──────────────────────────────────────────────
  {
    name: 'Atonik 1.8SL', group: 'Chất điều hòa sinh trưởng', activeIngredient: 'Hỗn hợp Sodium ortho-nitrophenolate, para-nitrophenolate, 5-nitroguaiacolate (tổng 1.8%)', manufacturer: 'Asahi Chemical',
    targets: 'Kích thích nảy mầm, tăng đậu trái, tăng năng suất trên lúa, rau, cây ăn quả',
    dosage: '10–25ml/bình 16–25 lít tuỳ cây trồng; ngâm hạt giống 5–10ml/10 lít nước',
    phi: 'Không áp dụng', compat: 'Phối được với hầu hết thuốc BVTV và phân bón lá, trừ khi nhãn có lưu ý riêng.',
    units: [{ unit: 'chai 25ml', price: 16000 }, { unit: 'chai 100ml', price: 52000 }],
  },
];

function buildDescription(p) {
  return `# ${p.name}

Nhóm sản phẩm: ${p.group}
Hoạt chất: ${p.activeIngredient}
Nhà sản xuất/đăng ký: ${p.manufacturer}

Đối tượng phòng trừ / công dụng: ${p.targets}

Liều dùng và cách sử dụng: ${p.dosage}

Thời gian cách ly: ${p.phi}

Lưu ý phối trộn/an toàn: ${p.compat}

Quy cách đóng gói và giá tham khảo (demo):
${p.units.map(u => `- ${u.unit}: ${Math.round(u.price).toLocaleString('vi-VN')}đ`).join('\n')}

Ghi chú: hoạt chất/công dụng/liều dùng theo danh mục thuốc BVTV được phép sử dụng tại Việt Nam (Cục Bảo vệ Thực vật, Bộ NN&PTNT). Quy cách đóng gói và giá là số liệu demo minh hoạ, không phải giá phân phối thật.`;
}

async function seed() {
  await initSchema();

  await query('DELETE FROM doc_chunks WHERE file_id = $1', [FILE_ID]);

  for (let i = 0; i < CATALOG.length; i++) {
    const p = CATALOG[i];
    const content = buildDescription(p);
    log.info(`[${i + 1}/${CATALOG.length}] Embedding: ${p.name}`);
    const vector = await embed(content);
    await query(
      `INSERT INTO doc_chunks (file_id, file_name, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4, $5)`,
      [FILE_ID, FILE_NAME, i, content, JSON.stringify(vector)]
    );

    for (const u of p.units) {
      await query(
        `INSERT INTO product_prices (product_name, unit, unit_price)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_name, unit) DO UPDATE SET unit_price = $3, updated_at = NOW()`,
        [p.name, u.unit, u.price]
      );
    }

    if (i < CATALOG.length - 1) {
      await new Promise(r => setTimeout(r, 600)); // giữ nguyên delay rate-limit Gemini free tier
    }
  }

  log.info(`Đã seed ${CATALOG.length} sản phẩm (${CATALOG.reduce((s, p) => s + p.units.length, 0)} dòng giá) ✓`);
}

if (process.argv[1]?.endsWith('seed-agri-catalog.js')) {
  await seed();
  process.exit(0);
}

export { seed };
