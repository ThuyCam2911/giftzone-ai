

| 🤖  ZALO AI SALES AGENT MVP Product Specification *Dành cho PO & Engineering Team  —  v1.1* |
| :---- |

| Phiên bản | MVP v1.1 |
| :---- | :---- |
| **Trạng thái** | Draft  |
| **Ngày tạo** | 6/6/2026 \- Miller  |
| **Audience** | PO, Tech Lead, Backend, Frontend |
| **Benchmark** | WeCom (WeChat Work) — Trung Quốc |

| 🎯  1\. BỐI CẢNH & VẤN ĐỀ |
| :---- |

## **1.1  Bài toán thực tế**

Nhân viên sale dùng Zalo cá nhân để giao tiếp với khách hàng. Doanh nghiệp không kiểm soát được hội thoại, không có AI hỗ trợ sale trong thời gian thực, và không có cơ chế bàn giao khách hàng khi sale thay đổi.

| ❌  TRƯỚC KHI CÓ GIẢI PHÁP Sale dùng Zalo cá nhân, công ty không kiểm soát Không có AI hỗ trợ sale khi đang chat với khách Manager không biết deal đang ở giai đoạn nào Bàn giao khách hàng khi sale thay đổi mất thời gian Không có tóm tắt cuộc hội thoại tự động | ✅  SAU KHI CÓ GIẢI PHÁP Agent Account thuộc doanh nghiệp, Manager làm trưởng nhóm AI hỗ trợ sale realtime ngay trong group chat Zalo Manager có dashboard tổng quan toàn bộ deals Sale mới được AI brief đầy đủ context khi tiếp quản Summary tự động ngày/tuần/tháng cho Manager |
| :---- | :---- |

## **1.2  Benchmark: WeCom (WeChat Work)**

Tencent đã giải quyết bài toán tương tự tại Trung Quốc — đạt 125 triệu MAU và trở thành app doanh nghiệp \#2 tại Trung Quốc. Zalo AI Sales Agent là phiên bản tương đương cho thị trường Việt Nam, với lớp AI thực sự thay vì chỉ rule-based chatbot như WeCom.

| 👥  2\. HỆ THỐNG & ACTORS |
| :---- |

## **2.1  Các actor trong hệ thống**

| Actor | Tên trong hệ thống | Vai trò |
| :---- | :---- | :---- |
| **🏢  Doanh nghiệp** | Admin / Owner | Onboard platform, cấu hình Agent, quản lý toàn bộ |
| **👤  Sale** | Sale Member | Tạo group với khách, add Agent, @agent khi cần hỗ trợ |
| **🛒  Khách hàng** | External User | Dùng Zalo cá nhân như bình thường, biết Agent là AI |
| **🤖  AI Agent** | AI Assistant \- \[Tên công ty\] | Lắng nghe, hỗ trợ sale, truy cập dữ liệu, gửi summary |
| **📊  Manager** | Manager / Trưởng nhóm | Phó/Trưởng nhóm trong group, nhận summary, assign sale |

## **2.2  Mô hình quản lý nhóm & quyền hạn**

|  | Nguyên tắc cấu trúc nhóm — Manager kiểm soát, Sale vận hành Doanh nghiệp tạo Zalo account mang tên 'AI Assistant \- \[Tên công ty\]' — account này thuộc doanh nghiệp. Khi Sale tạo group với khách: Sale add cả AI Agent VÀ Manager vào group. Manager được set làm Phó nhóm (hoặc Trưởng nhóm) ngay từ đầu — doanh nghiệp luôn có quyền kiểm soát. Khi Sale cũ rời đi: Manager tự set mình làm Trưởng nhóm, add Sale mới vào. AI brief context đầy đủ. Account Agent không bao giờ bị remove khỏi group — đảm bảo liên tục lắng nghe và tổng hợp. |
| :---- | :---- |

| 🔄  3\. USER FLOWS |
| :---- |

## **3.1  Onboarding doanh nghiệp**

| \# | Bước | Chi tiết |
| ----- | :---- | :---- |
| **1** | **Đăng ký** | Doanh nghiệp đăng ký tài khoản platform. Admin nhận email hướng dẫn. |
| **2** | **Tạo Agent Account** | DN tự tạo Zalo account tên 'AI Assistant \- \[Tên công ty\]'. Platform hướng dẫn bảo mật: dedicated SIM, không mở Zalo Web song song. |
| **3** | **Kết nối platform** | DN cung cấp credentials. Platform login QR, lưu session, xác nhận kết nối thành công. |
| **4** | **Kết nối Google Drive** | Admin cấp quyền đọc Google Drive — chọn folder chứa tài liệu (bảng giá, giải pháp, FAQ). Platform index nội dung. |
| **5** | **Cấu hình Agent** | Admin nhập: tone of voice, escalation rules, danh sách sale, cấu hình summary schedule. |
| **6** | **Test & Go-live** | Admin tạo group test, xác nhận Agent hoạt động đúng, publish cho sale team. |

## **3.2  Luồng bình thường — Sale tạo group với khách**

| \# | Bước | Chi tiết |
| ----- | :---- | :---- |
| **1** | **Tạo group** | Sale tạo Zalo group với khách hàng. Đặt tên group theo quy ước công ty. |
| **2** | **Add thành viên** | Sale add 3 thành viên vào group: Khách hàng \+ AI Agent \+ Manager (theo đúng thứ tự này). |
| **3** | **Set quyền Manager** | Sale set Manager làm Phó nhóm hoặc Trưởng nhóm. AI Agent là thành viên thường. |
| **4** | **Agent welcome** | Agent gửi tự động: 'Xin chào, tôi là AI Assistant của \[Công ty\]. Tôi sẽ hỗ trợ anh/chị trong suốt quá trình tư vấn.' |
| **5** | **Passive mode** | Agent im lặng, ghi nhận toàn bộ context, phân tích sentiment & giai đoạn deal. |
| **6** | **@agent trigger** | Sale gõ '@agent \[câu hỏi\]' → Agent truy cập Google Drive → reply chính xác vào group. VD: '@agent bảng giá gói Enterprise' → Agent lấy thông tin từ file bảng giá. |
| **7** | **Direct Message (DM) gợi ý** | Agent chủ động DM riêng cho sale: 'Khách đang so sánh với đối thủ — đây là thời điểm tốt để gửi case study.' |
| **8** | **Summary** | Cuối ngày/tuần/tháng: Agent gửi summary cho Manager theo lịch đã cấu hình. |

## **3.3  Luồng bàn giao khi Sale thay đổi**

|  | Lưu ý thiết kế — Không có 'take-over tự động' Manager luôn có mặt trong group từ đầu (Phó/Trưởng nhóm). Khi Sale cũ rời đi, không cần thao tác phức tạp. Quy trình dưới đây là best practice — nên được đưa vào offboarding checklist của công ty. |
| :---- | :---- |

| \# | Bước | Chi tiết |
| ----- | :---- | :---- |
| **1** | **Sale báo nghỉ** | Sale thông báo cho Manager. Manager chuẩn bị danh sách group cần bàn giao. |
| **2** | **Sale remove bản thân** | Sale tự rời khỏi các group. Manager (đang là Phó/Trưởng nhóm) tự động trở thành người quản lý. |
| **3** | **AI brief context** | Manager @agent trong group: 'Tóm tắt deal này'. Agent trả lời đầy đủ: giai đoạn, pain points, các cam kết đã thực hiện. |
| **4** | **Add Sale mới** | Manager add Sale B vào group. Agent tự động DM cho Sale B: context đầy đủ về khách hàng. |
| **5** | **Thông báo khách** | Manager hoặc Agent gửi message vào group giới thiệu Sale B với khách. |
| **6** | **Tiếp tục** | Sale B tiếp quản với đầy đủ context. Không cần khách hàng lặp lại thông tin. |

| 📂  4\. GOOGLE DRIVE INTEGRATION |
| :---- |

## **4.1  Mục đích**

Agent cần truy cập dữ liệu thực của doanh nghiệp để trả lời chính xác trong group chat — không hallucinate, không cần sale nhớ từng chi tiết. Đây là điểm khác biệt cốt lõi so với chatbot thông thường.

## **4.2  Cấu trúc dữ liệu khuyến nghị**

| Loại tài liệu | Ví dụ file | Agent dùng khi nào |
| :---- | :---- | :---- |
| **Bảng giá** | *pricing\_2025.xlsx, bang\_gia\_dn.pdf* | Khách hỏi giá, @agent bảng giá, so sánh gói |
| **Tài liệu giải pháp** | *solution\_overview.pdf, deck\_enterprise.pptx* | Khách hỏi tính năng, use case, so sánh với đối thủ |
| **FAQ & Objection handling** | *faq.docx, objection\_guide.md* | Khách có thắc mắc, phản đối, do dự |
| **Case study & Testimonial** | *case\_study\_retail.pdf* | Khách muốn bằng chứng thực tế, proof of concept |
| **Chính sách & Điều khoản** | *policy.pdf, contract\_template.docx* | Khách hỏi về bảo mật, SLA, điều khoản hợp đồng |

## **4.3  Cơ chế hoạt động**

|  | RAG Pipeline — Retrieval Augmented Generation Onboarding: Admin cấp quyền đọc Google Drive folder → Platform index toàn bộ tài liệu (chunking \+ embedding). Realtime: Khi có @agent query → Agent tìm kiếm trong index → Lấy đúng đoạn liên quan → Claude tổng hợp thành câu trả lời tự nhiên. Sync: Admin upload file mới lên Drive → Platform tự động re-index trong vòng 15 phút. Trích dẫn nguồn: Agent luôn ghi rõ 'Theo bảng giá tháng 06/2025:...' để sale và khách tin tưởng độ chính xác. |
| :---- | :---- |

|  | ⚠️  Giới hạn cần làm rõ với khách hàng Agent chỉ trả lời dựa trên tài liệu đã được index — không tự suy diễn ngoài phạm vi tài liệu. File cần ở định dạng: PDF, DOCX, XLSX, Google Docs/Sheets/Slides (native). Tránh file scan không có text layer. Tài liệu nhạy cảm (hợp đồng ký kết, thông tin cá nhân KH) nên đặt trong folder riêng, không index. |
| :---- | :---- |

| 📊  5\. SUMMARY & DASHBOARD |
| :---- |

## **5.1  Summary tự động — 3 chu kỳ**

| Chu kỳ | Gửi cho | Thời điểm | Nội dung chính |
| :---- | :---- | :---- | :---- |
| **📅  Ngày** | Sale \+ Manager | 18:00 mỗi ngày làm việc | Tin nhắn nổi bật, phản hồi của khách, việc cần làm hôm sau |
| **📆  Tuần** | Manager | Thứ 6, 17:00 | Tổng quan toàn bộ group, deals tiến triển, deals cần attention |
| **🗓️  Tháng** | Manager \+ Admin | Ngày cuối tháng | Báo cáo tổng hợp: số group mới, chuyển đổi, top/bottom performer |

## **5.2  Cấu trúc Summary ngày — mẫu nội dung**

| 📋  Summary ngày — Group: \[Tên KH\] — 05/06/2025 🔹 Giai đoạn deal: Đang thương lượng giá — Khách chưa chốt 🔹 Highlights hôm nay: Khách xác nhận ngân sách \~150tr. Hỏi về timeline triển khai và SLA. 🔹 Phản hồi của khách: Tích cực — quan tâm tính năng báo cáo, lo ngại về chi phí ẩn. 🔹 AI đã hỗ trợ (2 lần): @agent bảng giá gói Pro → Đã trả lời thông tin gói Pro 50 user, 85tr/năm (nguồn: pricing\_Q2\_2025.xlsx) @agent SLA cam kết → Đã trả lời uptime 99.5%, support 8x5, hotline riêng cho Enterprise (nguồn: policy.pdf) 🔹 Việc cần làm ngày mai: Gửi case study ngành bán lẻ theo yêu cầu khách. Follow up timeline. ⚠️  Cần attention: Khách hỏi về 'chi phí ẩn' — Sale cần clarify trực tiếp, không để qua đêm. |
| :---- |

## **5.3  Dashboard Manager — Các màn hình chính**

| Màn hình | Nội dung hiển thị |
| :---- | :---- |
| **📋  Tổng quan** | Số group đang active, số deal theo giai đoạn (Mới / Đang tư vấn / Chờ chốt / Đã chốt), alerts cần xử lý hôm nay |
| **💬  Danh sách Groups** | Tên group, Sale phụ trách, giai đoạn deal, tin nhắn cuối, trạng thái Agent. Filter theo sale/giai đoạn/thời gian. |
| **📑  Chi tiết Group** | Lịch sử summary ngày. Log tất cả lần Agent được @mention: câu hỏi, câu trả lời, tài liệu được dùng, thời gian. |
| **📈  Analytics** | Số lần Agent được hỏi theo ngày/tuần. Top câu hỏi phổ biến. Tài liệu được truy cập nhiều nhất. Thống kê deal. |
| **👥  Quản lý Sale** | Danh sách sale, số group phụ trách, tình trạng. Assign/reassign group khi sale thay đổi. |
| **⚙️  Cài đặt** | Cấu hình Agent, quản lý Google Drive folder, schedule summary, tone of voice, escalation rules. |

|  | Log AI Interactions — Tính năng quan trọng cho trust & audit Mỗi lần Agent được @mention và trả lời: ghi lại timestamp, câu hỏi gốc, câu trả lời đầy đủ, tài liệu nguồn được dùng. Manager có thể xem lại toàn bộ lịch sử AI đã nói gì với khách — quan trọng cho accountability. Nếu AI trả lời sai: Manager dễ dàng xác định, sửa tài liệu nguồn, và thông báo lại cho khách. Export được ra CSV/PDF cho mục đích báo cáo nội bộ hoặc audit. |
| :---- | :---- |

| ⚡  6\. TÍNH NĂNG MVP — SCOPE & PRIORITY |
| :---- |

P0 \= must-have để launch. P1 \= should-have trong MVP. P2 \= backlog sau MVP.

| Tính năng | Mô tả | Actor | Priority | Khả thi |
| ----- | ----- | :---: | :---: | :---: |
| **Kết nối Agent** | DN cấp credentials, platform login & duy trì session Zalo | Admin | **P0** | **✅ Được** |
| **Listen group** | Agent lắng nghe realtime tất cả tin nhắn trong group | System | **P0** | **✅ Được** |
| **@agent trigger** | Sale @mention → Agent query Drive → Reply bằng Claude AI | Sale | **P0** | **✅ Được** |
| **Google Drive RAG** | Index tài liệu Drive, tìm kiếm semantic, trích dẫn nguồn | System | **P0** | **✅ Được** |
| **Welcome message** | Agent gửi intro tự động khi join group mới | System | **P0** | **✅ Được** |
| **Daily summary** | Agent gửi summary cuối ngày cho Sale & Manager | System | **P0** | **✅ Được** |
| **Weekly summary** | Tổng hợp tuần cho Manager mỗi thứ 6 | System | **P1** | **✅ Được** |
| **Monthly summary** | Báo cáo tháng cho Admin & Manager | System | **P1** | **✅ Được** |
| **Log AI interactions** | Ghi lại mỗi lần @agent: câu hỏi, trả lời, tài liệu nguồn | System | **P0** | **✅ Được** |
| **Dashboard groups** | Danh sách group, deal stage, trạng thái Agent | Manager | **P1** | **✅ Được** |
| **Chi tiết group** | Lịch sử summary \+ log AI interactions theo group | Manager | **P1** | **✅ Được** |
| **Context briefing** | @agent tóm tắt deal khi bàn giao cho sale mới | Agent | **P1** | **✅ Được** |
| **Session recovery** | Auto-recover khi Zalo session expire, alert admin | System | **P0** | **✅ Được** |
| **Drive sync** | Re-index tự động khi có file mới/cập nhật trên Drive | System | **P1** | **✅ Được** |
| **DM gợi ý Sale** | Agent chủ động DM riêng sale khi phát hiện opportunity | System | **P1** | **✅ Được** |
| **Analytics dashboard** | Top câu hỏi, tài liệu dùng nhiều, deal metrics | Manager | **P2** | **✅ Được** |
| **Export report** | Export summary/log ra PDF, CSV | Manager | **P2** | **✅ Được** |

| 🏗️  7\. TECH STACK & KIẾN TRÚC |
| :---- |

| Layer | Technology | Lý do |
| :---- | :---- | :---- |
| **Zalo Interface** | **zca-js (npm)** | Unofficial API — duy nhất giải quyết group chat personal account |
| **AI Brain** | **Claude API (claude-sonnet-4)** | Hiểu ngữ cảnh tốt, tiếng Việt tốt, tool use cho RAG |
| **Drive Integration** | **Google Drive API v3** | OAuth 2.0, đọc file, watch changes để auto re-index |
| **Vector Search** | **pgvector (PostgreSQL ext.)** | Lưu embedding, tìm kiếm semantic cho RAG pipeline |
| **Backend** | **Node.js \+ Express** | Cùng runtime với zca-js, async I/O phù hợp |
| **Database** | **PostgreSQL \+ pgvector** | Conversation log, deal context, AI interaction log, embeddings |
| **Session Store** | **Redis** | Zalo session, message queue, rate limiting |
| **Dashboard** | **Next.js \+ React** | Web app manager, SSR cho performance |
| **Deploy** | **VPS (1 process/tenant hoặc shared)** | Kiểm soát session stability, isolation giữa tenants |
| **Scheduler** | **node-cron** | Daily/weekly/monthly summary, Drive sync, health check |

|  | ⚠️  Spike kỹ thuật cần validate tuần đầu 2\. zca-js: Session stability — expire sau bao lâu? Cơ chế auto-recover không cần scan QR lại? 3\. Google Drive API: Thời gian index 100-200 trang tài liệu? Rate limit khi query thường xuyên? 4\. pgvector: Performance semantic search với \~10,000 chunks — đủ nhanh cho realtime response? |
| :---- | :---- |

| ⚠️  8\. RISKS & MITIGATION |
| :---- |

| Rủi ro | Impact | Mitigation | Mức độ |
| :---- | :---- | :---- | :---: |
| Zalo ban account | Dịch vụ ngừng với tenant đó | Behavior tự nhiên, không spam. Account DN, không phải account của mình. Plan B: session mới. | **CAO** |
| zca-js ngừng maintain | Mất interface với Zalo | Fork và maintain internal version. Đàm phán API chính thức với Zalo song song. | **TRUNG BÌNH** |
| Session Zalo expire | Agent offline, miss tin nhắn | Health check mỗi 30 phút. Alert admin ngay. QR re-login flow đơn giản. | **TRUNG BÌNH** |
| AI trả lời sai từ Drive | Sai thông tin giá/chính sách cho khách | Luôn trích dẫn nguồn. Manager có thể review log. Sale confirm trước khi chốt. | **TRUNG BÌNH** |
| Drive file không chuẩn | Index kém, câu trả lời thiếu chính xác | Hướng dẫn DN chuẩn hóa file. Checklist onboarding. Hỗ trợ format chuẩn. | **THẤP** |
| Pháp lý: AI không khai báo | Vi phạm quy định, mất trust | Luôn khai báo 'AI Assistant' trong tên account và welcome message. | **THẤP** |

| 📅  9\. ROADMAP MVP — 2-3 tuần |
| :---- |

| Tuần | Nhiệm vụ | Owner | Output |
| :---- | :---- | :---- | :---- |
|  | Spike: test zca-js admin rights, session stability, Google Drive API performance | Tech Lead | Feasibility report \+ go/no-go |
|  | Setup infra: Node.js, PostgreSQL \+ pgvector, Redis, deploy pipeline, Google Drive OAuth | Backend | Môi trường dev live |
|  | Core: Zalo listener, @agent trigger, Claude API \+ RAG pipeline (Drive → embed → search → reply) | Backend | Agent trả lời được từ Drive |
|  | Session management, Drive auto-sync, AI interaction logging, welcome message | Backend | Session stable, log đầy đủ |
|  | Summary engine: daily/weekly/monthly, cấu trúc nội dung, DM gợi ý cho sale | Backend \+ PO | Summary tự động chạy đúng giờ |
|  | Dashboard: group list, deal stage, AI interaction log, chi tiết group | Frontend | Manager có thể dùng dashboard |
|  | Onboarding flow: Drive setup wizard, agent config, tone of voice, test group | Frontend \+ Backend | Onboard được trong \< 30 phút |
|  | Context briefing flow, assign sale, analytics cơ bản | Backend \+ Frontend | Bàn giao deal end-to-end |
|  | Onboard 3-5 pilot, bug fix, feedback, polish | Toàn team | 5 pilot accounts live |

| ✅  10\. DEFINITION OF DONE |
| :---- |

## **MVP hoàn thành khi đáp ứng đủ các tiêu chí:**

| ✅ | Doanh nghiệp tự onboard được trong \< 30 phút: tạo account, kết nối Drive, cấu hình Agent |
| :---- | :---- |
| ✅ | Agent hoạt động trong group: nhận tin nhắn, reply khi @mention, không miss message |
| ✅ | Agent truy cập đúng tài liệu Drive, trích dẫn nguồn, không hallucinate thông tin ngoài tài liệu |
| ✅ | Session Zalo ổn định, auto-recovery khi expire, alert admin kịp thời |
| ✅ | Daily summary gửi đúng giờ, đúng người, đúng nội dung theo mẫu đã định nghĩa |
| ✅ | Log đầy đủ mỗi lần AI được @mention: câu hỏi, trả lời, tài liệu nguồn, timestamp |
| ✅ | Manager xem được tất cả groups, deal status, và AI interaction log trên dashboard |
| ✅ | Context briefing hoạt động: @agent tóm tắt deal đầy đủ cho sale mới khi bàn giao |
| ✅ | 5 pilot doanh nghiệp sử dụng thực tế ≥ 2 tuần, không có sự cố nghiêm trọng |
| ✅ | Agent luôn khai báo rõ là AI — đúng quy định pháp lý Việt Nam |

|  | Sau MVP — Bước tiếp theo Dùng traction từ 5 pilot để tiếp cận Zalo Technology Partner Program — WeCom là case study mang vào phòng họp. Nếu Zalo cấp API chính thức: migrate từ zca-js sang API chính thức, mở rộng scale không giới hạn. Mở rộng nguồn dữ liệu: Notion, Confluence, SharePoint — không chỉ Google Drive. Tích hợp CRM: tự động sync deal status từ group chat vào HubSpot/Salesforce. |
| :---- | :---- |

