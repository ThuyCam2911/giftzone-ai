# Skill: Refresh Zalo Session

**Khi nào dùng**: Agent log lỗi `zpw_enk null`, `SESSION EXPIRED`, hoặc "Another connection is opened".

## Triệu chứng session hết hạn

```
[Session] Health check FAIL — session có thể đã expire
[Session] ⚠️  SESSION EXPIRED — Cần lấy cookie mới từ chat.zalo.me
```

Hoặc agent crash ngay khi login với lỗi cookie-related.

## Các bước refresh

### Bước 1: Đóng agent

```bash
# Nếu đang chạy trong terminal: Ctrl+C
# Nếu chạy bằng pm2: pm2 stop giftzone-agent
```

### Bước 2: Lấy cookie mới từ Zalo Web

1. Mở Chrome/Firefox
2. Vào `https://chat.zalo.me`
3. Đăng nhập bằng **số điện thoại +84812377267** (account agent)
4. Sau khi vào được chat:
   - Chrome: F12 → Application → Storage → Cookies → `https://chat.zalo.me`
   - Cài extension **J2TEAM Cookies** → Export cookies → copy JSON

### Bước 3: Lấy thêm IMEI và User-Agent (nếu cần)

Trong DevTools Console của `chat.zalo.me`:
```js
// Lấy IMEI
localStorage.getItem('z_uuid')
// Hoặc tìm trong request headers khi gửi tin nhắn
```

### Bước 4: Cập nhật .env

Sửa tay file `agent/.env`:
```
ZALO_COOKIE=[paste JSON array cookie vào đây]
ZALO_IMEI=xxxx (nếu thay đổi)
```

### Bước 5: Đóng browser tab chat.zalo.me

**QUAN TRỌNG**: Phải đóng tab `chat.zalo.me` trước khi khởi động agent. Hai kết nối cùng lúc sẽ fail.

### Bước 6: Restart agent

```bash
cd /Users/thuycam/Desktop/GiftZone/giftzone-agent/agent
SKIP_INDEX=true npm start
```

Dùng `SKIP_INDEX=true` để agent khởi động nhanh, không cần index lại Drive.

## Verify

Trong log phải thấy:
```
[Session] Login OK — Agent ID: 634236733944735279
```

Sau đó @mention agent trong group test `6598808947011857265` để xác nhận nhận được tin.
