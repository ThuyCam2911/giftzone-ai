# zEnterprise — Tính năng GiftZone cung cấp cho Jollibee

> Phạm vi tài liệu: **không bao gồm phần AI trả lời tự động khách hàng** (Jollibee đã có AI chatbot riêng — nếu cần, GiftZone chỉ đóng vai trò tích hợp/kết nối dữ liệu, không thay thế AI hiện tại của Jollibee). Tài liệu tập trung vào phần **quản lý tài khoản theo chi nhánh, giám sát vận hành, và thống kê hiệu suất** cho mô hình nhắn tin 1:1 trực tiếp với khách hàng.

---

## 1. Quản lý tài khoản zEnterprise theo chi nhánh

Mỗi tài khoản zEnterprise đại diện cho **1 chi nhánh/cửa hàng** Jollibee, nhắn tin trực tiếp với khách hàng trên Zalo.

**Thông tin quản lý mỗi tài khoản:**
- Tên tài khoản, email, mật khẩu (lưu dưới dạng mã hoá)
- **Chi nhánh** (branch) — vd "Jollibee Nguyễn Trãi", "Jollibee Q7"...
- **Vai trò**: Sales / CS / Manager / Technical
- **Trạng thái**: Active / Inactive

**Thao tác hỗ trợ**: thêm / sửa / xoá tài khoản qua giao diện, có xác nhận trước khi xoá. Thẻ thống kê nhanh: tổng số / đang hoạt động / ngưng hoạt động.

---

## 2. Quản lý hội thoại 1:1 (Inbox)

Đây là màn hình vận hành chính, hiển thị toàn bộ hội thoại 1:1 giữa khách hàng và tài khoản Zalo của từng chi nhánh:

- Danh sách hội thoại: tên khách, tin nhắn gần nhất, số tin chưa đọc
- **Quản lý được theo từng store**: có thể xem/lọc hội thoại theo từng chi nhánh riêng biệt, phục vụ mô hình nhiều cửa hàng
- Biểu tượng cho biết AI đang chủ động trả lời hay nhân viên đã **"tiếp quản" (take over)**
- **Nút bật/tắt AI cho từng hội thoại riêng lẻ** — khi tắt, hệ thống hiện rõ "AI đã tạm dừng, chỉ nhân viên trả lời", tránh AI và người trả lời chồng chéo
- Nhân viên **gõ và gửi tin trực tiếp ngay trên Dashboard** — tin được gửi qua Zalo thật, hiển thị trạng thái gửi theo thời gian thực

---

## 3. Phân loại tin nhắn khách hàng — nền tảng cho tiếp nhận đơn hàng

Tin nhắn khách gửi tới được tự động gắn nhãn theo 4 nhóm:

| Nhãn | Ý nghĩa |
|---|---|
| **Đặt hàng** | Khách đặt món, đặt bàn, hỏi giao hàng, thanh toán |
| **Khiếu nại** | Khách phàn nàn, không hài lòng, yêu cầu hoàn tiền/trả hàng |
| **Khuyến mãi** | Khách hỏi về ưu đãi, voucher, combo |
| **Thông tin** | Khách hỏi giá, địa chỉ, giờ mở cửa, menu |

Nhãn này giúp Jollibee biết được bao nhiêu % tin nhắn là đơn hàng, bao nhiêu % là khiếu nại ở từng cửa hàng, theo thời gian. Đây là nền tảng có thể mở rộng thành một hệ thống theo dõi đơn hàng đầy đủ (mã đơn, trạng thái, giá trị đơn hàng) nếu Jollibee có nhu cầu.

---

## 4. Phát hiện vấn đề chất lượng phục vụ tự động (bằng AI)

Hệ thống dùng AI quét từng hội thoại định kỳ để tự động phát hiện các vấn đề trong chất lượng phục vụ:

| Loại vấn đề | Ý nghĩa |
|---|---|
| Không phản hồi | Chưa trả lời khách |
| Phản hồi chậm | Trả lời trễ so với thời gian chuẩn |
| Thái độ không phù hợp | Nhân viên có thái độ chưa tốt |
| Khách phàn nàn | Phát hiện khách đang không hài lòng |
| Thất hứa với khách | Đã hứa nhưng chưa thực hiện |
| Bỏ lỡ cơ hội bán hàng | Khách có nhu cầu nhưng chưa được tư vấn kịp |
| Bỏ dở hội thoại | Hội thoại đang dang dở không có kết thúc |
| Tương tác thấp | Khách ít phản hồi/quan tâm |
| Cảm xúc tiêu cực | Khách có dấu hiệu bực bội, thất vọng |

Mỗi vấn đề được gắn mức độ ưu tiên (khẩn cấp / cao / trung bình / thấp), có thể xử lý và đánh dấu đã giải quyết ngay trên Dashboard. Hệ thống tính ra **Điểm chất lượng phục vụ** cho từng chi nhánh, giúp nhận diện ngay chi nhánh nào cần cải thiện mà không cần đọc thủ công từng hội thoại.

---

## 5. Dashboard giám sát & thống kê hiệu suất theo chi nhánh

Có thể lọc theo **khoảng thời gian** và theo **từng chi nhánh cụ thể**.

- Tổng tin nhắn, số khách hàng, số chi nhánh hoạt động trong kỳ, biểu đồ khối lượng tin nhắn theo ngày
- Bảng so sánh hiệu suất giữa các chi nhánh: số tin nhắn, số issue đang mở, Điểm chất lượng phục vụ
- Top câu hỏi khách hỏi nhiều nhất, giúp Jollibee biết khách quan tâm điều gì nhất
- Thời gian phản hồi trung bình theo chi nhánh
- Danh sách câu hỏi chưa được trả lời — để bổ sung quy trình/kịch bản phục vụ
- Nhật ký toàn bộ tương tác, phục vụ audit/kiểm tra khi cần

**Có thể bổ sung các chỉ số (metrics) tuỳ chỉnh theo nhu cầu riêng của Jollibee** — vd chỉ số đặc thù ngành F&B, KPI riêng theo chi nhánh, báo cáo theo mẫu riêng của Jollibee. Phần này có thể phát sinh chi phí tuỳ theo mức độ phức tạp của yêu cầu.

---

## 6. Mức độ tuỳ biến (Customize)

| Hạng mục | Tuỳ biến được | Cách làm |
|---|---|---|
| Ngôn ngữ dashboard | VI / EN đầy đủ toàn bộ giao diện | Chuyển đổi ngay trên Sidebar |
| Số lượng chi nhánh | Không giới hạn | Thêm tài khoản zEnterprise mới cho mỗi chi nhánh |
| Vai trò nhân sự | Sales / CS / Manager / Technical | Gắn nhãn hiển thị, dùng để lọc/phân tích |
| Cấu hình hệ thống | Tên hiển thị, khung giờ báo cáo... | Áp dụng ngay, không cần chờ triển khai lại |
| Công thức tính điểm/chỉ số | Có thể tuỳ chỉnh theo công thức Jollibee cung cấp | Đội ngũ kỹ thuật GiftZone triển khai theo yêu cầu cụ thể |

---

## 7. Tóm tắt giá trị cho Jollibee

Bỏ qua phần AI trả lời khách hàng (Jollibee đã có sẵn), GiftZone cung cấp lớp **giám sát & tối ưu vận hành đa chi nhánh cho kênh nhắn tin 1:1**:

1. Quản lý tập trung tài khoản theo từng chi nhánh
2. Inbox thực chiến theo từng store: xem hội thoại 1:1, bật/tắt AI theo từng ca, nhân viên trả lời tay khi cần
3. Tự động gắn nhãn tin nhắn đơn hàng/khiếu nại/khuyến mãi/thông tin — nền tảng để mở rộng thành theo dõi đơn hàng đầy đủ
4. AI tự động phát hiện vấn đề chất lượng phục vụ, chấm điểm và so sánh giữa các chi nhánh
5. Dashboard thống kê hiệu suất theo chi nhánh, có thể mở rộng thêm chỉ số tuỳ chỉnh theo nhu cầu riêng
6. Sẵn sàng tích hợp thêm AI của Jollibee nếu cần, thay vì bắt buộc dùng AI của GiftZone
