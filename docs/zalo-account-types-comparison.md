# ZEnterprise — Khác biệt cốt lõi so với Personal Account / ZBusiness / Zalo OA

> Tổng hợp cho việc trao đổi với Jollibee về lộ trình chuyển đổi ZBusiness → ZEnterprise. Chỉ gồm thông tin đã xác nhận.

## Key differences của ZEnterprise

1. **Tài khoản thuộc về doanh nghiệp, không thuộc về cá nhân** — khác với Personal Account và ZBusiness (dù có lớp business phía trên vẫn là tài khoản cá nhân về bản chất), ZEnterprise do doanh nghiệp sở hữu trực tiếp.

2. **Đổi mật khẩu, thu hồi tài khoản được mà không mất lịch sử chat với khách hàng** — vì tài khoản thuộc doanh nghiệp, khi nhân viên nghỉ việc hoặc cần thu hồi quyền truy cập, doanh nghiệp có thể đổi mật khẩu/thu hồi tài khoản mà vẫn giữ nguyên toàn bộ quan hệ và lịch sử hội thoại với khách hàng — không bị mất đi theo nhân sự như tài khoản cá nhân.

3. **Quản lý được tin nhắn, đánh giá được mức độ chăm sóc khách hàng** — nhờ có API chính thức lấy được dữ liệu chat, doanh nghiệp có thể giám sát tin nhắn, đo lường chất lượng phục vụ (thời gian phản hồi, phát hiện vấn đề, v.v.) — điều mà Personal Account và ZBusiness không làm được (không có API).

4. **Tiếp cận khách hàng như tin nhắn cá nhân, không cần follow OA** — khác với Zalo OA (tin tư vấn bắt buộc khách phải follow OA trước), ZEnterprise nhắn tin/gọi điện được ngay như tài khoản cá nhân, chỉ cần người nhận chấp nhận tin nhắn từ người lạ.

## Operations — các bước khi chuyển đổi ZBusiness → ZEnterprise

1. **Đăng ký và thông báo danh sách SĐT thuộc doanh nghiệp** (đề xuất: 5–10 số)
2. **Đổi SĐT cá nhân đang dùng thành 1 SĐT doanh nghiệp** trong danh sách trên
3. **Bấm đồng ý consent** — xác nhận đồng ý chuyển đổi từ ZBusiness sang ZEnterprise

Lưu ý: chat API chỉ lấy được hội thoại **từ thời điểm chuyển đổi trở đi** — báo cáo/phân tích phụ thuộc dữ liệu lịch sử cần xuất/lưu trữ trước khi chuyển đổi. Việc rollback về ZBusiness **không thực hiện được** sau khi đã chuyển đổi.

## Roadmap

| Giai đoạn | Nội dung |
|---|---|
| **Pilot** | Quản lý 10 tài khoản ZEnterprise |
| **Golive** | Mở rộng vận hành cho 250 cửa hàng bằng tài khoản ZEnterprise, sau khi pilot không phát sinh vấn đề ở mức critical |
| **Enhance** | AI phân tích các chỉ số vận hành |
| **Tích hợp AI** | Kết nối thêm AI vào luồng vận hành |

⚠️ **Cần lưu ý về timeline**: mốc thời gian có thể thay đổi — sẽ có nhiều biến số phát sinh trong quá trình triển khai.
