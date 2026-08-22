/**
 * Seed catalog nông dược/thuốc BVTV MỞ RỘNG cho demo showoff (nhánh ai-for-demo).
 *
 * ⚠️ TOÀN BỘ tên sản phẩm, hoạt chất, liều dùng, giá đều là DỮ LIỆU GIẢ LẬP cho
 * mục đích ghi hình demo — KHÔNG phải sản phẩm/giá thật của GiftZone hay bất kỳ
 * nhà sản xuất nào. Không dùng làm căn cứ tư vấn kỹ thuật/mua bán thật.
 *
 * Mỗi sản phẩm được:
 * 1. Ghi thành 1 đoạn văn mô tả đầy đủ (hoạt chất, đối tượng phòng trừ, liều
 *    dùng, thời gian cách ly, lưu ý phối trộn/an toàn) → embed + insert vào
 *    doc_chunks (giống hệt cách indexer.js làm với file Drive thật) để RAG
 *    (retriever.js) trả lời được các câu hỏi phức tạp/so sánh sản phẩm.
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
  {
    name: 'Rầy Diệt 200WP', group: 'Thuốc trừ sâu', activeIngredient: 'Imidacloprid 200g/kg',
    targets: 'Rầy nâu, rầy lưng trắng trên lúa; bọ trĩ trên dưa hấu, dưa lưới',
    dosage: '10-15g/bình 25 lít, phun ướt đều 2 mặt lá khi rầy tuổi 1-3',
    phi: '7 ngày', compat: 'Không phối chung với thuốc có tính kiềm mạnh (vôi, Bordeaux).',
    units: [
      { unit: 'gói 20g', price: 18000 },
      { unit: 'gói 100g', price: 78000 },
      { unit: 'bao 1kg', price: 690000 },
    ],
  },
  {
    name: 'Sâu Cuốn Lá 5EC', group: 'Thuốc trừ sâu', activeIngredient: 'Emamectin benzoate 5%',
    targets: 'Sâu cuốn lá, sâu đục thân trên lúa; sâu tơ, sâu xanh trên rau họ cải',
    dosage: '10ml/bình 25 lít, phun khi sâu mới nở, tuổi 1-2 hiệu quả cao nhất',
    phi: '5 ngày', compat: 'Phối được với hầu hết thuốc trừ bệnh gốc đồng, không phối với thuốc trừ cỏ.',
    units: [
      { unit: 'chai 100ml', price: 42000 },
      { unit: 'chai 500ml', price: 185000 },
      { unit: 'can 1 lít', price: 340000 },
    ],
  },
  {
    name: 'Bọ Trĩ Tiêu 480SC', group: 'Thuốc trừ sâu', activeIngredient: 'Spirotetramat 480g/l',
    targets: 'Bọ trĩ, rệp sáp trên cây có múi (cam, quýt, bưởi); nhện đỏ trên ớt',
    dosage: '8-10ml/bình 25 lít, phun ướt cả mặt dưới lá',
    phi: '14 ngày', compat: 'Không phối với dầu khoáng nồng độ cao, dễ gây cháy lá non.',
    units: [
      { unit: 'chai 100ml', price: 95000 },
      { unit: 'chai 250ml', price: 210000 },
    ],
  },
  {
    name: 'Sâu Đục Trái 40WG', group: 'Thuốc trừ sâu', activeIngredient: 'Flubendiamide 40%',
    targets: 'Sâu đục trái trên xoài, ổi, đậu bắp; sâu keo mùa thu trên bắp',
    dosage: '4-5g/bình 25 lít, phun định kỳ 7 ngày/lần trong giai đoạn ra trái',
    phi: '3 ngày', compat: 'An toàn với ong và thiên địch nếu phun đúng liều.',
    units: [
      { unit: 'gói 10g', price: 32000 },
      { unit: 'gói 100g', price: 280000 },
    ],
  },
  {
    name: 'Nhện Đỏ Xanh 100SC', group: 'Thuốc trừ sâu', activeIngredient: 'Fenpyroximate 5% + Abamectin 1.8%',
    targets: 'Nhện đỏ, nhện vàng trên cây có múi, hoa hồng, hoa cúc',
    dosage: '15ml/bình 25 lít, phun 2 lần cách nhau 5-7 ngày để diệt cả trứng',
    phi: '10 ngày', compat: 'Không phối với thuốc trừ bệnh gốc lưu huỳnh.',
    units: [
      { unit: 'chai 100ml', price: 55000 },
      { unit: 'chai 500ml', price: 240000 },
    ],
  },
  {
    name: 'Đạo Ôn Chặn 75WP', group: 'Thuốc trừ bệnh', activeIngredient: 'Tricyclazole 75%',
    targets: 'Bệnh đạo ôn lá và đạo ôn cổ bông trên lúa',
    dosage: '15-20g/bình 25 lít, phun phòng khi lúa 30-35 ngày và trước trổ 5-7 ngày',
    phi: '14 ngày', compat: 'Không phối với phân bón lá có chứa đồng, giảm hiệu lực thuốc.',
    units: [
      { unit: 'gói 100g', price: 32000 },
      { unit: 'gói 500g', price: 145000 },
      { unit: 'bao 1kg', price: 270000 },
    ],
  },
  {
    name: 'Khô Vằn Sạch 300SC', group: 'Thuốc trừ bệnh', activeIngredient: 'Hexaconazole 5% + Validamycin 3%',
    targets: 'Bệnh khô vằn, lem lép hạt trên lúa; bệnh gỉ sắt trên cà phê',
    dosage: '20ml/bình 25 lít, phun khi bệnh mới xuất hiện, lặp lại sau 7 ngày nếu nặng',
    phi: '7 ngày', compat: 'Có thể phối với thuốc trừ sâu gốc Abamectin.',
    units: [
      { unit: 'chai 100ml', price: 38000 },
      { unit: 'chai 480ml', price: 165000 },
    ],
  },
  {
    name: 'Vàng Lá Thối Rễ 720WP', group: 'Thuốc trừ bệnh', activeIngredient: 'Mancozeb 64% + Metalaxyl 8%',
    targets: 'Bệnh vàng lá thối rễ, xì mủ trên cây có múi, sầu riêng; bệnh mốc sương trên khoai tây, cà chua',
    dosage: '30-40g/bình 25 lít phun lá, hoặc 50g/gốc pha tưới gốc phòng thối rễ',
    phi: '7 ngày', compat: 'Không phối chung với thuốc có tính axit mạnh.',
    units: [
      { unit: 'gói 100g', price: 22000 },
      { unit: 'gói 500g', price: 95000 },
      { unit: 'bao 1kg', price: 175000 },
    ],
  },
  {
    name: 'Thán Thư Diệt 250EC', group: 'Thuốc trừ bệnh', activeIngredient: 'Difenoconazole 25%',
    targets: 'Bệnh thán thư trên xoài, ớt, thanh long; bệnh đốm lá trên rau ăn lá',
    dosage: '10ml/bình 25 lít, phun định kỳ 10 ngày/lần trong mùa mưa',
    phi: '7 ngày', compat: 'Phối tốt với phân bón lá vi lượng.',
    units: [
      { unit: 'chai 100ml', price: 48000 },
      { unit: 'chai 500ml', price: 210000 },
    ],
  },
  {
    name: 'Sương Mai Chặn 68WP', group: 'Thuốc trừ bệnh', activeIngredient: 'Chlorothalonil 50% + Metalaxyl-M 18%',
    targets: 'Bệnh sương mai trên dưa leo, bầu bí, nho; bệnh mốc sương trên cà chua',
    dosage: '25g/bình 25 lít, phun phòng trước mùa mưa và định kỳ 7 ngày trong mùa mưa',
    phi: '5 ngày', compat: 'Không phối với thuốc có tính kiềm.',
    units: [
      { unit: 'gói 100g', price: 28000 },
      { unit: 'gói 500g', price: 120000 },
    ],
  },
  {
    name: 'Cỏ Sạch Toàn Diện 480SL', group: 'Thuốc trừ cỏ', activeIngredient: 'Glyphosate IPA salt 480g/l',
    targets: 'Cỏ tranh, cỏ ống, cỏ lá rộng trên đất vườn cây ăn trái, đất trống trước gieo trồng',
    dosage: '80-100ml/bình 25 lít, phun khi cỏ đang phát triển mạnh, không phun khi sắp mưa',
    phi: 'Không áp dụng (trừ cỏ trước trồng)', compat: 'Không phun dính lên cây trồng chính, thuốc không chọn lọc.',
    units: [
      { unit: 'can 1 lít', price: 75000 },
      { unit: 'can 5 lít', price: 340000 },
      { unit: 'thùng 4 can 5 lít', price: 1280000 },
    ],
  },
  {
    name: 'Cỏ Lúa An Toàn 10WP', group: 'Thuốc trừ cỏ', activeIngredient: 'Bensulfuron-methyl 10%',
    targets: 'Cỏ lồng vực, cỏ chác, rau mác trên ruộng lúa sạ',
    dosage: '15g/bình 25 lít, phun 5-7 ngày sau sạ khi ruộng đủ ẩm',
    phi: 'Không hạn chế (chọn lọc, an toàn với lúa)', compat: 'Không phối với phân bón lá có đạm cao ngay sau phun.',
    units: [
      { unit: 'gói 25g', price: 12000 },
      { unit: 'gói 100g', price: 42000 },
    ],
  },
  {
    name: 'Cỏ Vườn Chọn Lọc 200EC', group: 'Thuốc trừ cỏ', activeIngredient: 'Quizalofop-P-ethyl 20%',
    targets: 'Cỏ lá hẹp (cỏ chỉ, cỏ mần trầu) trong vườn rau, đậu, không hại cây lá rộng',
    dosage: '20ml/bình 25 lít, phun khi cỏ 3-5 lá, tránh phun lên lá cây trồng chính',
    phi: '7 ngày', compat: 'Không phối với thuốc trừ cỏ lá rộng gốc 2,4-D.',
    units: [
      { unit: 'chai 100ml', price: 45000 },
      { unit: 'chai 480ml', price: 195000 },
    ],
  },
  {
    name: 'Đa Xanh NPK 30-10-10+TE', group: 'Phân bón lá', activeIngredient: 'N-P-K 30-10-10 + vi lượng Zn, Bo, Mg',
    targets: 'Kích thích ra đọt, phát triển thân lá cho tất cả cây trồng giai đoạn sinh trưởng',
    dosage: '25-30g/bình 25 lít, phun định kỳ 7-10 ngày/lần',
    phi: 'Không áp dụng (phân bón lá)', compat: 'Phối được với hầu hết thuốc trừ sâu bệnh, trừ thuốc có tính kiềm.',
    units: [
      { unit: 'gói 100g', price: 20000 },
      { unit: 'gói 500g', price: 85000 },
      { unit: 'bao 1kg', price: 155000 },
    ],
  },
  {
    name: 'Đa Xanh Bông Trái 10-55-10', group: 'Phân bón lá', activeIngredient: 'N-P-K 10-55-10 + Bo',
    targets: 'Kích thích ra hoa đồng loạt, đậu trái trên cây ăn trái, hoa màu',
    dosage: '20-25g/bình 25 lít, phun trước giai đoạn ra hoa 7-10 ngày',
    phi: 'Không áp dụng (phân bón lá)', compat: 'Không phối với phân bón có hàm lượng đạm cao cùng lúc.',
    units: [
      { unit: 'gói 100g', price: 24000 },
      { unit: 'gói 500g', price: 100000 },
    ],
  },
  {
    name: 'Đa Xanh Chắc Hạt 15-5-40', group: 'Phân bón lá', activeIngredient: 'N-P-K 15-5-40 + Canxi, Bo',
    targets: 'Nuôi hạt, chắc trái, tăng độ ngọt trên lúa giai đoạn trổ, cây ăn trái giai đoạn nuôi trái',
    dosage: '25g/bình 25 lít, phun 2 lần cách nhau 10 ngày trong giai đoạn nuôi hạt/trái',
    phi: 'Không áp dụng (phân bón lá)', compat: 'Phối tốt với thuốc trừ bệnh giai đoạn trổ.',
    units: [
      { unit: 'gói 100g', price: 22000 },
      { unit: 'gói 500g', price: 92000 },
      { unit: 'bao 1kg', price: 165000 },
    ],
  },
  {
    name: 'Amino Xanh Rong Biển', group: 'Phân bón lá', activeIngredient: 'Chiết xuất rong biển + Amino acid 15%',
    targets: 'Giải độc, phục hồi cây sau ngập úng/xịt thuốc liều cao, tăng đề kháng cho tất cả cây trồng',
    dosage: '25ml/bình 25 lít, phun khi cây có dấu hiệu suy yếu hoặc định kỳ 15 ngày/lần',
    phi: 'Không áp dụng (phân bón lá hữu cơ)', compat: 'Phối được với hầu hết thuốc BVTV.',
    units: [
      { unit: 'chai 100ml', price: 25000 },
      { unit: 'chai 500ml', price: 105000 },
      { unit: 'can 1 lít', price: 195000 },
    ],
  },
  {
    name: 'Siêu Ra Rễ Humic', group: 'Phân bón lá', activeIngredient: 'Acid Humic 5% + NAA 0.1%',
    targets: 'Kích thích ra rễ mới, phục hồi bộ rễ cho cây con, cây sau chiết/ghép, cây bị ngộ độc phân',
    dosage: '20ml/bình 25 lít tưới gốc, hoặc pha đậm đặc hơn để nhúng bầu cây con',
    phi: 'Không áp dụng', compat: 'Không phối chung với thuốc trừ cỏ.',
    units: [
      { unit: 'chai 100ml', price: 30000 },
      { unit: 'chai 500ml', price: 125000 },
    ],
  },
  {
    name: 'Nghịch Vụ Ra Hoa 400SP', group: 'Chất điều hòa sinh trưởng', activeIngredient: 'Paclobutrazol 40%',
    targets: 'Xử lý ra hoa nghịch vụ trên xoài, sầu riêng; hãm ngọn cho cây kiểng',
    dosage: 'Tưới gốc 10-15g/gốc pha với 10 lít nước tuỳ tán cây, xử lý khi cây đủ lá già',
    phi: 'Không áp dụng (xử lý ra hoa)', compat: 'Không phối với phân bón đạm cao cùng thời điểm xử lý.',
    units: [
      { unit: 'gói 100g', price: 55000 },
      { unit: 'gói 500g', price: 240000 },
    ],
  },
  {
    name: 'Đậu Trái Chống Rụng 10SL', group: 'Chất điều hòa sinh trưởng', activeIngredient: 'Gibberellic acid (GA3) 1%',
    targets: 'Chống rụng hoa, rụng trái non trên cây có múi, xoài, nho',
    dosage: '10ml/bình 25 lít, phun giai đoạn đậu trái non, không phun quá liều gây trái dị dạng',
    phi: '7 ngày', compat: 'Không phối với thuốc trừ cỏ.',
    units: [
      { unit: 'chai 20ml', price: 15000 },
      { unit: 'chai 100ml', price: 62000 },
    ],
  },
  {
    name: 'Trái To Đều 20WP', group: 'Chất điều hòa sinh trưởng', activeIngredient: 'Cytokinin (6-BA) 20%',
    targets: 'Kích thích trái to đều, tăng trọng lượng trên dưa hấu, dưa lưới, bầu bí',
    dosage: '5g/bình 25 lít, phun 2 lần cách nhau 7 ngày giai đoạn trái non',
    phi: '7 ngày', compat: 'Phối tốt với phân bón lá NPK cân đối.',
    units: [
      { unit: 'gói 10g', price: 18000 },
      { unit: 'gói 100g', price: 155000 },
    ],
  },
  {
    name: 'Tuyến Trùng Diệt 10GR', group: 'Xử lý đất', activeIngredient: 'Ethoprophos 10%',
    targets: 'Tuyến trùng hại rễ trên hồ tiêu, cà phê, cây có múi; rệp sáp gốc',
    dosage: '20-30g/gốc, rải quanh gốc cách thân 20-30cm rồi tưới nước, xử lý đầu và cuối mùa mưa',
    phi: '30 ngày (thuốc xử lý đất, dạng hạt)', compat: 'Không trộn chung với phân bón trong cùng lượt rải.',
    units: [
      { unit: 'gói 1kg', price: 65000 },
      { unit: 'bao 5kg', price: 290000 },
    ],
  },
  {
    name: 'Đất Sạch Nấm Bệnh 3SC', group: 'Xử lý đất', activeIngredient: 'Trichoderma spp. 10^8 CFU/g + Chitosan',
    targets: 'Đối kháng nấm Fusarium, Phytophthora gây thối rễ, xì mủ trên sầu riêng, hồ tiêu, cây có múi',
    dosage: '30-50ml/gốc pha loãng tưới gốc, xử lý định kỳ 2-3 tháng/lần phòng bệnh',
    phi: 'Không áp dụng (sinh học)', compat: 'Không phối với thuốc trừ nấm hóa học trong cùng lượt tưới (giảm hiệu lực vi sinh).',
    units: [
      { unit: 'chai 500ml', price: 85000 },
      { unit: 'can 5 lít', price: 720000 },
    ],
  },
  {
    name: 'Ốc Bươu Vàng Diệt 700WP', group: 'Thuốc trừ ốc', activeIngredient: 'Niclosamide 70%',
    targets: 'Ốc bươu vàng hại lúa giai đoạn mạ non',
    dosage: '15-20g/bình 25 lít phun trên mặt ruộng, hoặc rải trực tiếp theo hướng dẫn bao bì khi ruộng có nước',
    phi: '7 ngày', compat: 'Không phun khi ruộng sắp xả nước ra kênh mương chung.',
    units: [
      { unit: 'gói 100g', price: 20000 },
      { unit: 'gói 500g', price: 85000 },
    ],
  },
  {
    name: 'Bọ Cánh Cứng Chặn 50WG', group: 'Thuốc trừ sâu', activeIngredient: 'Thiamethoxam 25% + Lambda-cyhalothrin 25%',
    targets: 'Bọ dừa, bọ cánh cứng hại dừa; rầy chổng cánh trên cây có múi (trung gian truyền bệnh vàng lá gân xanh)',
    dosage: '5-8g/bình 25 lít, phun ướt đều tán lá, đặc biệt đọt non',
    phi: '10 ngày', compat: 'Không phối với thuốc trừ bệnh gốc đồng.',
    units: [
      { unit: 'gói 10g', price: 15000 },
      { unit: 'gói 100g', price: 135000 },
    ],
  },
];

function buildDescription(p) {
  return `# ${p.name}

Nhóm sản phẩm: ${p.group}
Hoạt chất: ${p.activeIngredient}

Đối tượng phòng trừ / công dụng: ${p.targets}

Liều dùng và cách sử dụng: ${p.dosage}

Thời gian cách ly: ${p.phi}

Lưu ý phối trộn/an toàn: ${p.compat}

Quy cách đóng gói và giá tham khảo:
${p.units.map(u => `- ${u.unit}: ${Math.round(u.price).toLocaleString('vi-VN')}đ`).join('\n')}

⚠️ Dữ liệu demo — không phải sản phẩm/giá bán thật.`;
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
