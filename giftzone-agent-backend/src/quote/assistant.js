/**
 * Quote Assistant — Sales @mention hỏi "báo giá" (1 hoặc NHIỀU sản phẩm cùng lúc)
 * → sản phẩm nào thiếu số lượng/quy cách thì hỏi lại riêng, đủ thông tin thì tự
 * tính tiền + xuất 1 file .docx gộp tất cả sản phẩm, gửi thẳng cho Sales.
 *
 * State "đang chờ trả lời số lượng" lưu ở bảng pending_quotes (không phải in-memory)
 * để không mất khi process restart, hết hạn sau PENDING_TTL_MINUTES không trả lời.
 * confirmed_items: sản phẩm đã đủ SL/quy cách; pending_products: tên SP còn thiếu.
 */
import { query } from '../utils/db.js';
import { matchProduct, getPriceRows, extractQuantityAndUnit, buildQuoteDocx } from './generator.js';

const PENDING_TTL_MINUTES = 15;

// Sentinel: đã xác nhận là yêu cầu báo giá nhưng CHƯA biết sản phẩm nào (vd
// Sales gõ "báo giá" rồi bấm Enter gửi ngay, tên sản phẩm gửi ở tin nhắn kế
// tiếp) — lưu tạm để tin nhắn kế tiếp (dù không chứa từ khoá "báo giá") vẫn
// được hiểu là tiếp nối, không bị rớt xuống RAG
const AWAITING_PRODUCT = '__AWAITING_PRODUCT__';

const QUOTE_KEYWORDS = ['báo giá', 'giá bao nhiêu', 'giá sao', 'bao nhiêu tiền', 'cho giá', 'giá cả', 'giá thế nào'];

// Tách câu thành từng đoạn — mỗi đoạn thường ứng với 1 sản phẩm khi Sales hỏi
// nhiều sản phẩm cùng lúc (vd "báo giá 20 chai Confidor, 10 gói Antracol").
// Dùng \s+và\s+ (yêu cầu khoảng trắng bao quanh) thay vì \bvà\b — JS regex \b
// coi ký tự có dấu (à, ê, ơ...) không phải "word char" nên \b không nhận diện
// đúng ranh giới sau "và", làm tách câu bị gộp nhầm hết vào 1 đoạn.
const SEGMENT_SPLIT_RE = /\n|,|;|\s+và\s+|\+/i;

export function isQuoteRequest(text) {
  const q = (text ?? '').toLowerCase();
  return QUOTE_KEYWORDS.some(k => q.includes(k));
}

function splitSegments(text) {
  return (text ?? '').split(SEGMENT_SPLIT_RE).map(s => s.trim()).filter(Boolean);
}

async function getPending(senderUid) {
  const { rows } = await query(
    `SELECT group_id, confirmed_items, pending_products FROM pending_quotes
     WHERE sender_uid = $1 AND updated_at >= NOW() - INTERVAL '${PENDING_TTL_MINUTES} minutes'`,
    [senderUid]
  );
  return rows[0] ?? null;
}

async function savePending(senderUid, groupId, confirmedItems, pendingProducts) {
  await query(
    `INSERT INTO pending_quotes (sender_uid, group_id, confirmed_items, pending_products, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (sender_uid) DO UPDATE
       SET group_id = $2, confirmed_items = $3, pending_products = $4, updated_at = NOW()`,
    [senderUid, groupId, JSON.stringify(confirmedItems), JSON.stringify(pendingProducts)]
  );
}

async function clearPending(senderUid) {
  await query(`DELETE FROM pending_quotes WHERE sender_uid = $1`, [senderUid]);
}

function askText(pendingProducts, priceRowsByProduct) {
  const blocks = pendingProducts.map(p => {
    const options = priceRowsByProduct[p]
      .map(r => `  - ${r.unit}: ${Math.round(r.unit_price).toLocaleString('vi-VN')}đ`)
      .join('\n');
    return `${p}:\n${options}`;
  }).join('\n\n');

  const example = pendingProducts.length > 1
    ? `\n\nTrả lời mỗi dòng 1 sản phẩm, vd:\n20 ${priceRowsByProduct[pendingProducts[0]][0].unit} ${pendingProducts[0]}\n10 ${priceRowsByProduct[pendingProducts[1]][0].unit} ${pendingProducts[1]}`
    : `\n\nTrả lời theo mẫu: "<số lượng> <quy cách>", vd "20 ${priceRowsByProduct[pendingProducts[0]][0].unit}"`;

  return `Bạn cần báo giá số lượng bao nhiêu và quy cách nào ạ?\n\n${blocks}${example}`;
}

async function finalize(confirmedItems, requesterName) {
  const { filePath, grandTotal } = await buildQuoteDocx({ items: confirmedItems, requesterName });
  const distinctProducts = new Set(confirmedItems.map(i => i.product_name)).size;
  const label = confirmedItems.length === 1
    ? `${confirmedItems[0].qty} ${confirmedItems[0].unit} ${confirmedItems[0].product_name}`
    : distinctProducts === 1
      ? `${confirmedItems[0].product_name} (${confirmedItems.length} quy cách)`
      : `${confirmedItems.length} dòng, ${distinctProducts} sản phẩm`;
  return {
    caption: `📄 Báo giá ${label} — tổng ${Math.round(grandTotal).toLocaleString('vi-VN')}đ`,
    filePath,
  };
}

// Parse 1 câu (có thể nhiều đoạn) → sản phẩm đã đủ SL/quy cách (confirmed) và
// sản phẩm chỉ mới nhắc tên, còn thiếu SL/quy cách (pending)
async function extractItemsFromText(text) {
  const confirmed = [];
  const pending = [];
  const seen = new Set();

  for (const seg of splitSegments(text)) {
    const matches = await matchProduct(seg);
    if (matches.length !== 1) continue; // bỏ qua đoạn không rõ / nhắc >1 sản phẩm
    const productName = matches[0];
    if (seen.has(productName)) continue;
    seen.add(productName);

    const priceRows = await getPriceRows(productName);
    if (priceRows.length === 0) continue; // chưa có giá cho SP này — bỏ qua, không báo giá được

    const found = extractQuantityAndUnit(seg, priceRows);
    if (found) {
      confirmed.push({ product_name: productName, unit: found.row.unit, unit_price: Number(found.row.unit_price), qty: found.qty });
    } else {
      pending.push(productName);
    }
  }
  return { confirmed, pending };
}

// Khớp câu trả lời của Sales với các sản phẩm đang chờ SL/quy cách. Nếu chỉ còn
// 1 sản phẩm đang chờ thì không bắt buộc Sales phải nhắc lại tên sản phẩm, và
// MỖI dòng khớp được sẽ tạo 1 dòng báo giá riêng cho sản phẩm đó (hỗ trợ báo
// giá nhiều quy cách khác nhau của cùng 1 sản phẩm, vd "20 chai 500ml, 10 chai
// 100ml" của cùng 1 SP — không chỉ lấy dòng đầu tiên rồi bỏ qua các dòng còn lại).
async function resolvePendingReplies(text, pendingProducts) {
  const newItems = [];
  const resolvedProductNames = new Set();
  const priceRowsByProduct = {};
  for (const p of pendingProducts) priceRowsByProduct[p] = await getPriceRows(p);

  const segments = splitSegments(text);
  const toItem = (p, found) => ({ product_name: p, unit: found.row.unit, unit_price: Number(found.row.unit_price), qty: found.qty });

  // Dòng có số nhưng cuối cùng không khớp được quy cách nào — báo lại rõ ràng
  // cho Sales biết, thay vì âm thầm bỏ qua khiến tưởng nhầm là bug/thiếu sản phẩm
  const usedSegments = new Set();

  if (pendingProducts.length === 1) {
    const p = pendingProducts[0];
    for (const seg of segments) {
      const found = extractQuantityAndUnit(seg, priceRowsByProduct[p]);
      if (found) { newItems.push(toItem(p, found)); resolvedProductNames.add(p); usedSegments.add(seg); }
    }
    if (newItems.length === 0) {
      const found = extractQuantityAndUnit(text, priceRowsByProduct[p]);
      if (found) { newItems.push(toItem(p, found)); resolvedProductNames.add(p); }
    }
    const skipped = newItems.length > 0 ? segments.filter(s => !usedSegments.has(s) && /\d/.test(s)) : [];
    return { newItems, resolvedProductNames, priceRowsByProduct, skipped };
  }

  // Bước 1: khớp theo tên sản phẩm được nhắc trong từng dòng (chính xác nhất,
  // không phụ thuộc thứ tự) — mỗi sản phẩm tối đa 1 dòng báo giá ở bước này
  for (const seg of segments) {
    const segLower = seg.toLowerCase();
    for (const p of pendingProducts) {
      if (resolvedProductNames.has(p)) continue;
      if (!segLower.includes(p.split(' ')[0].toLowerCase())) continue;
      const found = extractQuantityAndUnit(seg, priceRowsByProduct[p]);
      if (found) { newItems.push(toItem(p, found)); resolvedProductNames.add(p); usedSegments.add(seg); }
    }
  }

  // Bước 2: fallback theo THỨ TỰ dòng — Sales hay trả lời tắt, không nhắc lại
  // tên sản phẩm (vd "20 chai 500ml\n10 chai 100ml"), ngầm hiểu dòng N ứng với
  // sản phẩm thứ N theo đúng thứ tự bot đã liệt kê lúc hỏi lại. Chỉ áp dụng khi
  // số dòng khớp đúng số sản phẩm đang chờ, tránh gán nhầm khi số dòng lệch.
  if (segments.length === pendingProducts.length) {
    pendingProducts.forEach((p, i) => {
      if (resolvedProductNames.has(p)) return;
      const found = extractQuantityAndUnit(segments[i], priceRowsByProduct[p]);
      if (found) { newItems.push(toItem(p, found)); resolvedProductNames.add(p); usedSegments.add(segments[i]); }
    });
  }

  const skipped = segments.filter(s => !usedSegments.has(s) && /\d/.test(s));
  return { newItems, resolvedProductNames, priceRowsByProduct, skipped };
}

/**
 * @returns {Promise<{handled: boolean, answer?: string, filePath?: string}>}
 *   handled=false → không phải yêu cầu báo giá, caller fallback bình thường
 */
export async function handleQuoteRequest(userQuery, { senderUid, groupId, senderName }) {
  const pending = await getPending(senderUid);

  // 1a. Đã hỏi "báo giá" trước đó nhưng chưa biết sản phẩm nào — tin nhắn này
  // (dù không chứa từ khoá "báo giá") được hiểu là tên sản phẩm Sales bổ sung
  if (pending && pending.pending_products.length === 1 && pending.pending_products[0] === AWAITING_PRODUCT) {
    const { confirmed, pending: pendingProducts } = await extractItemsFromText(userQuery);
    if (confirmed.length === 0 && pendingProducts.length === 0) {
      // Vẫn chưa nhận diện được sản phẩm — giữ tiếp trạng thái chờ, hỏi lại
      return {
        handled: true,
        answer: 'Bạn cần báo giá sản phẩm nào ạ? (vd: Confidor 100SL, Anvil 5SC, Sofit 300EC...)',
      };
    }
    if (pendingProducts.length === 0) {
      await clearPending(senderUid);
      const { caption, filePath } = await finalize(confirmed, senderName);
      return { handled: true, answer: caption, filePath };
    }
    const priceRowsByProduct = {};
    for (const p of pendingProducts) priceRowsByProduct[p] = await getPriceRows(p);
    await savePending(senderUid, groupId, confirmed, pendingProducts);
    return { handled: true, answer: askText(pendingProducts, priceRowsByProduct) };
  }

  // 1b. Đang chờ Sales trả lời SL/quy cách cho 1 hoặc nhiều sản phẩm đã biết tên
  if (pending && pending.pending_products.length > 0) {
    const { newItems, resolvedProductNames, priceRowsByProduct, skipped } = await resolvePendingReplies(userQuery, pending.pending_products);
    const skippedNote = skipped?.length
      ? `\n\n⚠️ Không nhận diện được quy cách cho dòng: ${skipped.map(s => `"${s}"`).join(', ')} — nếu dòng này là sản phẩm khác, ghi rõ tên sản phẩm kèm theo.`
      : '';

    if (newItems.length === 0) {
      // Không parse được gì — nếu tin nhắn rõ ràng không liên quan báo giá thì bỏ qua, không chặn câu hỏi khác của Sales
      if (!/\d/.test(userQuery) && !isQuoteRequest(userQuery)) return { handled: false };
      return { handled: true, answer: askText(pending.pending_products, priceRowsByProduct) };
    }

    const confirmedItems = [...pending.confirmed_items, ...newItems];
    const stillPending = pending.pending_products.filter(p => !resolvedProductNames.has(p));

    if (stillPending.length > 0) {
      await savePending(senderUid, groupId, confirmedItems, stillPending);
      return { handled: true, answer: askText(stillPending, priceRowsByProduct) + skippedNote };
    }

    await clearPending(senderUid);
    const { caption, filePath } = await finalize(confirmedItems, senderName);
    return { handled: true, answer: caption + skippedNote, filePath };
  }

  // 2. Yêu cầu báo giá mới (1 hoặc nhiều sản phẩm)
  if (!isQuoteRequest(userQuery)) return { handled: false };

  const { confirmed, pending: pendingProducts } = await extractItemsFromText(userQuery);
  if (confirmed.length === 0 && pendingProducts.length === 0) {
    // Chưa nhận diện được sản phẩm nào — lưu trạng thái "đang chờ tên sản phẩm"
    // để tin nhắn kế tiếp (vd chỉ gõ "Anvil 5SC") vẫn được hiểu là tiếp nối,
    // dù bản thân nó không chứa từ khoá "báo giá"
    await savePending(senderUid, groupId, [], [AWAITING_PRODUCT]);
    return {
      handled: true,
      answer: 'Bạn cần báo giá sản phẩm nào ạ? (vd: Confidor 100SL, Anvil 5SC, Sofit 300EC...)',
    };
  }

  if (pendingProducts.length === 0) {
    const { caption, filePath } = await finalize(confirmed, senderName);
    return { handled: true, answer: caption, filePath };
  }

  const priceRowsByProduct = {};
  for (const p of pendingProducts) priceRowsByProduct[p] = await getPriceRows(p);
  await savePending(senderUid, groupId, confirmed, pendingProducts);
  return { handled: true, answer: askText(pendingProducts, priceRowsByProduct) };
}
