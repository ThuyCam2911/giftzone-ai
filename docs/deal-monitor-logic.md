# Logic của `giftzone-deal-monitor`

> Tổng hợp từ code thực tế (`giftzone-agent-backend/src/`) tính đến commit `54c4c00`. Đây là service Render thứ 2, dùng chung 1 codebase với `giftzone-ai` nhưng bật/tắt tính năng qua biến môi trường.

## 1. Mục đích

Đọc tin nhắn ở các **nhóm khách hàng** (account Zalo riêng — "account 2", khác với account chạy `giftzone-ai`), phát hiện vấn đề chất lượng chăm sóc (sales phản hồi chậm, bỏ khách, thái độ...) và báo cáo cho quản lý — **không** đóng vai trò trả lời khách bằng tài liệu công ty.

## 2. Cấu hình Render (theo CLAUDE.md, set thủ công trên dashboard — không có trong `render.yaml`)

| Biến | Giá trị | Vai trò |
|---|---|---|
| `SKIP_ZALO` | *(không set / false)* | **Phải kết nối Zalo** — cần đọc tin nhắn nhóm khách theo thời gian thực. Nếu set `true` sẽ tắt toàn bộ phần dưới đây. |
| `ENABLE_RAG` | `false` | Tắt trả lời RAG docs (tài liệu công ty) — account này không nên tư vấn sản phẩm cho khách |
| `ENABLE_DEAL_ANALYSIS` | `true` | Bật cron phát hiện issue (phần lõi của service này) |
| `INSTANCE_ID` | `dealmonitor` | Cookie lưu ở key riêng `zalo_cookie_dealmonitor`, tránh đè cookie của `giftzone-ai` |
| `GEMINI_API_KEY` | *(có)* | Dùng chung 1 key cho cả Ops Assistant lẫn Deal Analyzer |
| `ZALO_COOKIE`, `ZALO_IMEI`, `ZALO_USER_AGENT` | *(account 2)* | Cookie/thiết bị của tài khoản Zalo thứ 2, **khác** account chạy `giftzone-ai` |

## 3. Trình tự khởi động (`src/index.js`)

Vì `SKIP_ZALO` không bật, deal-monitor chạy **toàn bộ** nhánh `else` trong `main()` — không chỉ riêng phần deal analysis:

```
1. initSchema() + loadConfig()
2. SessionManager.login()               → account 2 đăng nhập Zalo
3. indexAll() (nếu skip_index != 'true') → *xem mục 6, có thể KHÔNG cần thiết*
4. GroupListener + MentionResponder     → luôn wire, enableRagDocs=false
5. startSummaryEngine()                 → *xem mục 6, có thể trùng với giftzone-ai*
   startAutoSync()                      → *xem mục 6, có thể KHÔNG cần thiết*
6. startDailyAlert(api)                 → *xem mục 6, có thể trùng với giftzone-ai*
7. startDealAnalyzer(api)               → vì ENABLE_DEAL_ANALYSIS=true (đây mới là mục tiêu chính)
8. Cookie refresh cron 3AM              → no-op trên Render (cần Chrome local)
9. HTTP health endpoint
```

## 4. Luồng dữ liệu chính — Deal Analyzer

```
GroupListener (account 2, mọi nhóm nó là member)
  → _handleMessage() → INSERT vào bảng `messages` (mọi tin nhắn, vô điều kiện)

Cron */15 * * * * (deal/analyzer.js runAnalysis)
  → getGroupsWithNewMessages()
      SELECT group_id FROM messages
      WHERE msg_ts > mốc lần chạy trước (bảng analyzer_runs)
        AND group_id KHÔNG thuộc group_type='internal'
  → với mỗi group có tin mới:
      fetchNewMessages()        — chỉ msg_type='text', từ mốc analyzer_runs
      detectIssues()            — gọi Gemini (gemini-2.5-flash-lite), prompt wrap
                                   trong <conversation> chống prompt injection,
                                   trả JSON array các issue_type + severity + evidence
      upsertIssue() mỗi issue   — INSERT hoặc UPDATE bảng sales_issues
                                   issue_key = `${groupId}__${issue_type}__${ngày}`
      sendCriticalAlert()       — issue MỚI + severity='critical' → gửi Zalo
                                   vào admin_group_id NGAY (không đợi 8AM)
      autoResolve()             — nếu messages.length >= 5: issue cũ không còn
                                   detect nữa → status='resolved'
      markAnalyzed()            — ghi mốc analyzer_runs.last_run = NOW()
  → delay 60s giữa các group (tránh rate limit Gemini free tier)
```

**Retry/degraded:** `callGemini()` thử lại tối đa 3 lần khi 429/503 (backoff 3s/6s/12s). Nếu vẫn fail → ghi `settings.analyzer_status='degraded'` (Dashboard Overview hiển thị banner cảnh báo). Khi Gemini hoạt động lại → tự ghi `'ok'`.

**Role tagging:** nếu bảng `gz_members` có dữ liệu, conversation gửi cho Gemini được gắn tag `[GZ-Sales]`/`[GZ-CS]`/`[GZ-Manager]`/`[GZ-Tech]`/`[KH]` để model phân biệt ai là nhân viên GiftZone. Bảng rỗng → không tag (an toàn, hành vi giống lúc chưa có role).

## 5. Ops Assistant + RAG trên deal-monitor

`MentionResponder` được khởi tạo với `{ enableRagDocs: false }` (từ `ENABLE_RAG=false`), nhưng **luôn** wire `listener.onMention` — nghĩa là:

- Nếu account 2 **cũng** là thành viên 1 nhóm `group_type='internal'` nào đó → `@mention` trong nhóm đó **vẫn được** Ops Assistant trả lời bình thường (hỏi issues/KPI/tóm tắt) — Ops tự giới hạn theo `group_type`, không phụ thuộc `ENABLE_RAG`.
- Nếu `@mention` trong nhóm khách (customer) hoặc chat 1:1 → rơi vào nhánh RAG docs nhưng bị `enableRagDocs=false` chặn lại → **im lặng, không trả lời**. Tin nhắn vẫn được log vào `messages` bình thường.
- Cooldown 3s/user áp dụng chung, không phân biệt account.

## 6. ⚠️ Những điểm cần rà soát (phát hiện khi đọc lại code, chưa xử lý)

1. **Comment sai trong `index.js:39`** — `if (skipZalo) { log.info('...chế độ Deal Monitor') }`. Comment này gọi nhánh `SKIP_ZALO=true` là "chế độ Deal Monitor", nhưng thực tế deal-monitor chạy `SKIP_ZALO=false` (phải kết nối Zalo để đọc tin nhắn khách). Comment gây hiểu nhầm, nên sửa lại hoặc xoá.

2. **Daily Alert có thể gửi trùng 2 lần** — `startDailyAlert(api)` chạy trong nhánh `else` (không skip Zalo), nghĩa là nếu cả `giftzone-ai` VÀ `giftzone-deal-monitor` đều set cùng 1 `admin_group_id`, quản lý sẽ nhận **2 tin nhắn daily alert giống hệt nhau lúc 8AM** — 1 từ mỗi service. Cần xác nhận: có đang xảy ra không? Nếu có, nên chỉ bật `startDailyAlert` ở 1 service (vd thêm biến `ENABLE_DAILY_ALERT`, mặc định bật, tắt trên deal-monitor).

3. **Summary Engine có thể gửi trùng** — tương tự, nếu account 2 cũng là member của cùng nhóm `internal` mà account `giftzone-ai` đang phục vụ, cả 2 service đều chạy `startSummaryEngine()` và đều query "nhóm internal có tin nhắn hôm nay" → gửi summary trùng lặp vào cùng nhóm đó.

4. **Index Drive + Auto-sync có thể không cần thiết** — `indexAll()` và `startAutoSync()` chạy vô điều kiện (chỉ check `skip_index` config, không check `ENABLE_RAG`). Vì deal-monitor đã tắt RAG docs hoàn toàn (`ENABLE_RAG=false`), việc index tài liệu Drive + poll Changes API mỗi 24h trên service này gần như vô nghĩa — tốn quota Gemini embedding (dùng chung `GEMINI_API_KEY` với `giftzone-ai`) mà không phục vụ mục đích gì. Có thể set `SKIP_INDEX=true` trên deal-monitor để tránh lãng phí, nhưng đây là cấu hình thủ công cần set đúng, không tự động.

5. **Session expired alert gửi vào `ZALO_TEST_GROUP_ID`** (`session.js` → `onExpired` callback trong `index.js`) — dùng biến `ZALO_TEST_GROUP_ID` cố định từ ENV, không phải `admin_group_id` từ Dashboard. Nếu 2 service dùng chung giá trị `ZALO_TEST_GROUP_ID` này, cảnh báo "session hết hạn" của account nào cũng vào chung 1 nhóm — cần xác nhận đây có phải là điều mong muốn không (thường thì nên biết rõ **account nào** hết hạn).

## 7. Bảng DB mà deal-monitor đọc/ghi

| Bảng | Đọc | Ghi |
|---|---|---|
| `messages` | ✅ (fetchNewMessages, summary, ops context) | ✅ (mọi tin nhắn nhận được) |
| `sales_issues` | ✅ (autoResolve, ops context) | ✅ (upsertIssue) |
| `analyzer_runs` | ✅ | ✅ (mốc lần chạy cuối/nhóm) |
| `group_names` | ✅ (lọc internal, tên nhóm) | ✅ (cache tên nhóm/1:1 khi gặp lần đầu) |
| `gz_members` | ✅ (role tagging) | ❌ |
| `settings` | ✅ (`admin_group_id`, `analyzer_status`, cookie) | ✅ (`analyzer_status`, `session_status`, cookie refresh) |
| `ai_logs` | — | ✅ (nếu Ops Assistant trả lời trong nhóm internal) |
| `doc_chunks` | — (RAG tắt) | có thể ✅ nếu chưa set `SKIP_INDEX=true` (xem mục 6.4) |

## 8. Liên quan bảo mật/pháp lý (đã note ở CLAUDE.md § Security Assessment)

Đây chính là service đọc + lưu vĩnh viễn + gửi Gemini phân tích **toàn bộ chat nhóm khách hàng** mà khách không được thông báo — rủi ro pháp lý theo Nghị định 13/2023/NĐ-CP, xem chi tiết mục 🔴-4 trong Security Assessment của `CLAUDE.md`.
