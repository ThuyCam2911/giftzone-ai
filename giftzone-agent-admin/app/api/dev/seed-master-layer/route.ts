import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { replacePageBlocks, type BlockPage } from '@/lib/queries/master-layer';

// Seed nội dung minh hoạ (demo showoff nhánh ai-for-demo) cho các trang Master
// Layer — Dashboard/Hệ thống nghiệp vụ (AgriDMS/Loyalty/CRM)/Report & Insight.
// Số liệu lấy theo đúng ảnh mẫu khách gửi (Dashboard, AgriDMS, Report) — phần
// Loyalty/CRM (không có trong ảnh) soạn tương tự văn phong để demo liền mạch.
// Idempotent: gọi lại bao nhiêu lần cũng an toàn (xoá rồi insert lại theo page).
export async function POST() {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pages: Record<BlockPage, { section: any; sort_order: number; data: any }[]> = {
    dashboard: [
      { section: 'kpi', sort_order: 1, data: { label: 'Đại lý & NPP active', value: '3.284', delta: '▲ 9% so kỳ trước', deltaTone: 'good', source: 'agridms · outlets · 25/07' } },
      { section: 'kpi', sort_order: 2, data: { label: 'Độ phủ địa bàn', value: '74', unit: '%', delta: '▲ 4 điểm', deltaTone: 'good', source: 'agridms · coverage · 25/07' } },
      { section: 'kpi', sort_order: 3, data: { label: 'Tần suất đặt hàng', value: '1,8', unit: '/tháng', delta: '▲ 0,2', deltaTone: 'good', source: 'agridms · orders · 25/07' } },
      { section: 'kpi', sort_order: 4, data: { label: 'Đại lý nguội (45 ngày)', value: '412', delta: '▼ 6% (đang giảm)', deltaTone: 'bad', source: 'agridms · dormant · 25/07' } },
      { section: 'kpi', sort_order: 5, data: { label: 'Điểm Loyalty đang tồn', value: '18,4M', delta: '▲ 11% · nghĩa vụ tăng', deltaTone: 'bad', source: 'loyalty · points_ledger · 25/07' } },
      { section: 'kpi', sort_order: 6, data: { label: 'Hội thoại đại lý / ngày', value: '542', delta: '▲ 6%', deltaTone: 'good', source: 'tier0 · conversations · 25/07' } },
      { section: 'kpi', sort_order: 7, data: { label: 'Chất lượng hội thoại TB', value: '82', unit: '/100', delta: '▲ 3', deltaTone: 'good', source: 'quality · score · 25/07' } },
      { section: 'alert', sort_order: 1, data: { title: '3 việc đang ở tay người quá SLA', description: 'gồm 1 vụ Đỏ đã bàn giao 2 giờ trước', tone: 'warn' } },
      { section: 'alert', sort_order: 2, data: { title: 'Tây Nam Bộ chất lượng thấp', description: 'điểm 71/100 · agent bị query nhiều', tone: 'danger' } },
      {
        section: 'chart', sort_order: 1, data: {
          title: 'Kích hoạt đại lý theo tháng', subtitle: '6 tháng gần nhất', unitLabel: 'Đại lý active (trăm)',
          categories: ['T02', 'T03', 'T04', 'T05', 'T06', 'T07'], values: [24, 26, 28, 30, 31, 33],
        },
      },
      {
        section: 'activity', sort_order: 1, data: {
          actor: 'AI', title: 'Agent Nhắc mùa vụ',
          description: 'dựng chiến dịch nhắc phun đạo ôn tới 28.400 người — vượt hạn mức kỹ sư, đã bàn giao GĐ Kinh doanh',
          meta: '25/07 11:05 · SuperFlow',
        },
      },
      {
        section: 'activity', sort_order: 2, data: {
          actor: 'AI-generated', title: 'Báo cáo "Độ phủ & đại lý nguội"',
          description: 'được AI cập nhật cho kỳ tuần 30', meta: '25/07 06:00 · AI-generated',
        },
      },
      {
        section: 'activity', sort_order: 3, data: {
          actor: 'Guardrail', title: 'Agent Tra cứu nhãn',
          description: 'chặn 3 yêu cầu khuyến cáo ngoài nhãn đăng ký', meta: '25/07 09:32 · Guardrail',
        },
      },
      {
        section: 'activity', sort_order: 4, data: {
          actor: 'Người xử lý', title: 'Kỹ sư Ngô Minh Trí',
          description: 'nhận escalation Đỏ E-1039 · khiếu nại cháy lá', meta: '25/07 08:16 · Người xử lý',
        },
      },
      {
        section: 'activity', sort_order: 5, data: {
          actor: 'Connector', title: 'Nhãn Vetora 250WG gia hạn',
          description: 'đồng bộ từ Drive · Pháp chế, hiệu lực sau 4 phút', meta: '21/07 14:00 · Connector',
        },
      },
      {
        section: 'insight', sort_order: 1, data: {
          body: 'Đại lý active tăng +9%, độ phủ đạt 74%. Tây Nguyên vẫn thấp nhất (61%) với 210 điểm chưa kích hoạt nằm trên tuyến hiện có. Đáng chú ý: trong 412 đại lý nguội có 96 điểm từng thuộc hạng Vàng và 71% trong số đó đã tất toán công nợ — nghĩ vì quan hệ hoặc đối thủ, không vì tiền.',
          source: 'Sinh bởi AI · agridms.outlets · dữ liệu đến 25/07 · narrative Mức 1 · có thể truy vết tới truy vấn gốc',
          ctaLabel: 'Xem báo cáo',
        },
      },
    ],
    agridms: [
      { section: 'kpi', sort_order: 1, data: { label: 'Đơn hàng tháng', value: '6.180', delta: '▲ 8%', deltaTone: 'good', source: 'agridms · orders' } },
      { section: 'kpi', sort_order: 2, data: { label: 'Tồn kho toàn hệ thống', value: '38.400', unit: 'thùng', delta: '— ổn định', deltaTone: 'neutral', source: 'agridms · stock' } },
      { section: 'kpi', sort_order: 3, data: { label: 'Lô cận date < 6 tháng', value: '2.140', unit: 'thùng', delta: '▲ 320', deltaTone: 'bad', source: 'agridms · expiry' } },
      {
        section: 'list', sort_order: 1, data: {
          title: 'Độ phủ theo vùng', subtitle: 'trong địa bàn của bạn',
          items: [{ label: 'Tây Nam Bộ', value: '82%' }],
        },
      },
      {
        section: 'list', sort_order: 2, data: {
          title: 'Cấu trúc kênh', subtitle: 'doanh số tháng 07',
          items: [
            { label: 'NPP cấp 1', sub: '84 điểm', value: '12,4 tỷ / tháng' },
            { label: 'Đại lý cấp 1', sub: '1.240 điểm', value: '18,9 tỷ / tháng' },
            { label: 'Đại lý cấp 2', sub: '1.960 điểm', value: '9,6 tỷ / tháng' },
          ],
        },
      },
      {
        section: 'insight', sort_order: 1, data: {
          body: '2.140 thùng sắp cận date trong 6 tháng tới, tập trung ở NPP cấp 1 khu vực Tây Nam Bộ — nên ưu tiên đẩy khuyến mãi xoay vòng kho trước khi hết hạn, tránh phải huỷ hàng.',
          source: 'Sinh bởi AI · agridms.stock + agridms.expiry · 25/07',
        },
      },
    ],
    loyalty: [
      { section: 'kpi', sort_order: 1, data: { label: 'Điểm đã phát hành', value: '52,1M', delta: '▲ 7%', deltaTone: 'good', source: 'loyalty · points_ledger' } },
      { section: 'kpi', sort_order: 2, data: { label: 'Điểm đang tồn (nghĩa vụ)', value: '18,4M', delta: '▲ 11%', deltaTone: 'bad', source: 'loyalty · points_ledger' } },
      { section: 'kpi', sort_order: 3, data: { label: 'Tỷ lệ đổi điểm', value: '64', unit: '%', delta: '▼ 3 điểm', deltaTone: 'bad', source: 'loyalty · redemption' } },
      {
        section: 'list', sort_order: 1, data: {
          title: 'Phân bố theo hạng', subtitle: 'tổng 3.284 đại lý',
          items: [
            { label: 'Kim cương', value: '2%' },
            { label: 'Vàng', value: '18%' },
            { label: 'Bạc', value: '46%' },
            { label: 'Thành viên', value: '34%' },
          ],
        },
      },
      {
        section: 'insight', sort_order: 1, data: {
          body: 'Tỷ lệ đổi điểm giảm 3 điểm trong khi điểm phát hành vẫn tăng — nghĩa vụ điểm tồn đang phình nhanh hơn tốc độ đại lý tiêu điểm. Nên xem lại danh mục quà đổi hoặc mở thêm ưu đãi đổi điểm theo mùa vụ.',
          source: 'Sinh bởi AI · loyalty.points_ledger + loyalty.redemption · 25/07',
        },
      },
    ],
    crm: [
      { section: 'kpi', sort_order: 1, data: { label: 'Cơ hội đang mở', value: '186', delta: '▲ 12', deltaTone: 'good', source: 'salezone · opportunities' } },
      { section: 'kpi', sort_order: 2, data: { label: 'Tỷ lệ chốt', value: '38', unit: '%', delta: '▲ 2 điểm', deltaTone: 'good', source: 'salezone · win_rate' } },
      { section: 'kpi', sort_order: 3, data: { label: 'Giá trị pipeline', value: '24,6 tỷ', delta: '▲ 5%', deltaTone: 'good', source: 'salezone · pipeline_value' } },
      {
        section: 'list', sort_order: 1, data: {
          title: 'Pipeline theo giai đoạn', subtitle: 'tháng 07',
          items: [
            { label: 'Tiếp cận', value: '8,1 tỷ' },
            { label: 'Báo giá', value: '9,4 tỷ' },
            { label: 'Đàm phán', value: '5,2 tỷ' },
            { label: 'Chốt đơn', value: '1,9 tỷ' },
          ],
        },
      },
      {
        section: 'insight', sort_order: 1, data: {
          body: 'Giai đoạn "Báo giá" đang chiếm tỷ trọng pipeline lớn nhất nhưng thời gian trung bình ở giai đoạn này dài gấp 1,6 lần các giai đoạn khác — Quote Desk (AI soạn báo giá, Sales duyệt trong vài phút) là điểm cải thiện tốc độ chốt rõ nhất.',
          source: 'Sinh bởi AI · salezone.opportunities · 25/07',
        },
      },
    ],
    report: [
      {
        section: 'report_card', sort_order: 1, data: {
          badge: 'AI-generated', title: 'Độ phủ & đại lý nguội — toàn quốc',
          tags: ['Đại lý', 'Độ phủ', 'Định kỳ · tháng'],
          insightBody: 'Độ phủ 74%, dẫn đầu Tây Nam Bộ (82%). Tây Nguyên thấp nhất (61%) với 210 đại lý chưa kích hoạt nằm trên tuyến hiện có. 412 đại lý nguội tập trung ở tuyến tỉnh xa, trong đó 96 đại lý từng thuộc hạng Vàng — nhóm này đáng cứu trước.',
          source: 'Sinh bởi AI · agridms.coverage + loyalty.tier · 25/07 06:00 · narrative Mức 1 · có thể truy vết tới truy vấn gốc',
          actions: ['Tạo chiến dịch từ insight', 'Giao việc cho tuyến', 'PPT Slide', 'XLS Excel', 'DOC Word'],
        },
      },
      {
        section: 'report_card', sort_order: 2, data: {
          badge: 'AI-generated', title: 'Khoảng trống tri thức & câu hỏi lặp',
          tags: ['Cả hai trục', 'Tri thức', 'Định kỳ · tuần'],
          insightBody: '5 nhóm câu hỏi lặp chưa có tài liệu, dẫn đầu là "quét tem không ra thông tin" (22 lần) và "phối trộn Vetora + KaliMax" (18 lần) — 2 câu hỏi này nên bổ sung tài liệu công bố ngay để AI trả lời chính xác thay vì lặp lại "chưa có thông tin".',
          source: 'Sinh bởi AI · ai_logs.is_answered=false · 25/07',
          actions: ['Giao đội kỹ thuật bổ sung tài liệu', 'PPT Slide', 'XLS Excel'],
        },
      },
      {
        section: 'report_card', sort_order: 3, data: {
          badge: 'AI-generated', title: 'Tốc độ Quote Desk — AI ⇄ Sales',
          tags: ['Quote Desk', 'Tốc độ', 'Định kỳ · tuần'],
          insightBody: 'Thời gian trung bình từ lúc khách hỏi báo giá đến khi Sales duyệt gửi lại qua Zalo đang ở mức nhanh hơn nhiều so với quy trình thủ công truyền thống — AI soạn sẵn đề xuất theo đúng bảng giá, Sales chỉ cần duyệt hoặc chỉnh nhẹ.',
          source: 'Sinh bởi AI · quote_negotiations · 25/07',
          actions: ['Xem chi tiết Quote Desk'],
        },
      },
    ],
  };

  for (const page of Object.keys(pages) as BlockPage[]) {
    await replacePageBlocks(page, pages[page]);
  }

  return NextResponse.json({ ok: true, pages: Object.keys(pages) });
}
