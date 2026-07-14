/**
 * Phân loại nhanh loại câu hỏi của khách — heuristic keyword-based (miễn phí,
 * không gọi Gemini) để không phát sinh thêm API call cho mỗi tin nhắn.
 * Dùng cho thống kê zEnterprise Dashboard (loại câu hỏi theo store/account).
 */

const COMPLAINT_KEYWORDS = [
  'khiếu nại', 'phàn nàn', 'không hài lòng', 'tệ quá', 'lỗi', 'sai rồi',
  'chậm quá', 'trả hàng', 'hoàn tiền', 'thất vọng', 'tức', 'bực',
];
const ORDER_KEYWORDS = [
  'đặt hàng', 'đặt món', 'đặt ', 'order', 'mua', 'giao hàng', 'giao tới', 'giao đến',
  'ship', 'còn hàng', 'đặt bàn', 'số lượng', 'thanh toán', 'đơn hàng',
];
const PROMOTION_KEYWORDS = [
  'khuyến mãi', 'giảm giá', 'ưu đãi', 'voucher', 'combo', 'sale', 'mã giảm',
];
const INFO_KEYWORDS = [
  'giá', 'thông tin', 'địa chỉ', 'giờ mở cửa', 'menu', 'ở đâu', 'có gì',
];

export function classifyQuestionType(text) {
  const q = (text ?? '').toLowerCase();
  if (!q.trim()) return 'other';
  if (COMPLAINT_KEYWORDS.some(k => q.includes(k))) return 'complaint';
  if (ORDER_KEYWORDS.some(k => q.includes(k))) return 'order';
  if (PROMOTION_KEYWORDS.some(k => q.includes(k))) return 'promotion';
  if (INFO_KEYWORDS.some(k => q.includes(k))) return 'info';
  return 'other';
}
