# Zalo Integration Guide

Tài liệu này tổng hợp cách tích hợp Zalo trong project GiftZone Agent, sử dụng thư viện **zca-js**.

---

## 1. Thư viện & Cách hoạt động

GiftZone dùng **zca-js** (không phải Zalo OA API chính thức). zca-js hoạt động bằng cách:
- Dùng **cookie** từ phiên đăng nhập `chat.zalo.me` trên trình duyệt
- Kết nối **WebSocket** để lắng nghe tin nhắn realtime
- Gửi tin nhắn qua API nội bộ của Zalo Web

> ⚠️ Đây là unofficial API — không được Zalo chính thức hỗ trợ. Có thể bị gián đoạn khi Zalo cập nhật.

---

## 2. Lấy Cookie (Credentials)

### Cần 3 thứ
| Biến ENV | Mô tả | Cách lấy |
|----------|-------|----------|
| `ZALO_COOKIE` | Cookie phiên đăng nhập | J2TEAM Cookie extension |
| `ZALO_IMEI` | Device fingerprint | Xem trong localStorage `chat.zalo.me` |
| `ZALO_USER_AGENT` | User-Agent trình duyệt | DevTools → Network → bất kỳ request → `User-Agent` header |

### Cách lấy Cookie bằng J2TEAM Extension
1. Cài extension **J2TEAM Cookies** (Chrome)
2. Mở `chat.zalo.me` → đăng nhập tài khoản Zalo
3. Click icon J2TEAM → **Export** → Copy JSON
4. Paste vào `ZALO_COOKIE` trong `.env`

Format cookie là JSON array:
```json
[{"name":"zpw_sek","value":"..."},{"name":"zpsid","value":"..."},...]
```

> ✅ Cookie hợp lệ phải có ít nhất `zpsid` và `zpw_sek`. Nếu thiếu `zpw_enk` thì session có thể không hoạt động đầy đủ.

### Cách lấy IMEI
1. Mở `chat.zalo.me` trên Chrome
2. Mở DevTools → Console
3. Chạy: `localStorage.getItem('z_uuid')` hoặc tìm key có chứa `imei`

---

## 3. Login & Khởi tạo API

```js
import { Zalo } from 'zca-js';

const cookieRaw = process.env.ZALO_COOKIE;
// Cookie có thể là JSON array — cần parse và wrap
let cookie = cookieRaw;
try {
  const parsed = JSON.parse(cookieRaw);
  if (Array.isArray(parsed)) {
    cookie = { url: 'https://chat.zalo.me', cookies: parsed };
  }
} catch {}

const zalo = new Zalo(
  {
    imei:      process.env.ZALO_IMEI,
    cookie:    cookie,
    userAgent: process.env.ZALO_USER_AGENT,
  },
  {
    selfListen: false,   // QUAN TRỌNG: false để không nhận tin của chính bot
    checkUpdate: false,
  }
);

const api = await zalo.login();
```

---

## 4. Lấy User ID / Group ID / Tên

### Lấy ID của chính bot (Agent ID)
```js
const ownId = await api.getOwnId();
// → '12345678901234567'  (string, số lớn)
```

### Lấy tên và thông tin group
```js
const res = await api.getGroupInfo(groupId);
const info = res?.gridInfoMap?.[groupId];
const groupName = info?.name;
```

### Lấy thông tin từ tin nhắn đến
Khi nhận message qua listener, `message.data` chứa:
```js
const data = message.data ?? {};

const senderUid  = data.uidFrom;    // UID người gửi (string)
const senderName = data.dName;      // Tên hiển thị người gửi
const content    = typeof data.content === 'string'
  ? data.content
  : JSON.stringify(data.content);   // Nội dung tin nhắn

const groupId    = data.idTo;       // Group ID (tin nhắn group)
const msgTs      = data.ts          // Timestamp (milliseconds, string)
  ? new Date(Number(data.ts))
  : new Date();
const mentions   = data.mentions ?? [];  // Mảng @mention trong tin
```

---

## 5. Lắng nghe Tin nhắn (Listener)

```js
import { MessageType } from 'zca-js';

api.listener.on('connected', () => {
  console.log('WebSocket connected');
});

api.listener.on('message', (message) => {
  // Phân loại loại tin nhắn
  if (message.type === MessageType.GroupMessage) {
    // Tin nhắn trong group
    const groupId = message.data.idTo ?? message.threadId;
  }

  if (message.type === MessageType.DirectMessage) {
    // Tin nhắn 1:1 (Direct Message)
    const userId = message.data.uidFrom;
  }
});

api.listener.on('closed', () => {
  // WebSocket bị đóng — thường do mở chat.zalo.me trên browser
  console.error('WebSocket closed!');
});

api.listener.on('error', (err) => {
  console.error('Listener error:', err);
});

api.listener.start(); // Bắt đầu lắng nghe
```

### Detect @mention bot trong group
```js
const isMentioned = mentions.some(
  (m) => String(m.uid ?? '') === String(ownId)
);
```

---

## 6. Gửi Tin nhắn

### Gửi vào group
```js
await api.sendMessage(
  { msg: 'Nội dung tin nhắn' },
  groupId,
  MessageType.GroupMessage
);
```

### Gửi tin nhắn 1:1 (Direct Message)
```js
await api.sendMessage(
  { msg: 'Nội dung tin nhắn' },
  userId,
  MessageType.DirectMessage  // QUAN TRỌNG: phải dùng DirectMessage, không phải UserMessage
);
```

> ⚠️ Dùng sai `MessageType` sẽ không báo lỗi nhưng tin nhắn sẽ không đến — hoặc trả về lỗi "Nhóm này không tồn tại".

---

## 7. Lưu ý Quan trọng

### Cookie bị expire
- Cookie Zalo web thường có thời hạn vài tuần đến vài tháng
- Health check mỗi 30 phút bằng `api.getOwnId()` — nếu fail thì session đã expire
- Khi expire: **lấy cookie mới** từ `chat.zalo.me` → cập nhật `ZALO_COOKIE` trong `.env` → restart

### Không được mở `chat.zalo.me` khi agent đang chạy
- Zalo chỉ cho phép **1 kết nối web** mỗi tài khoản
- Nếu mở `chat.zalo.me` trên browser, WebSocket của agent bị đóng → agent ngừng nhận tin
- Triệu chứng: log xuất hiện `"Another connection is opened"` hoặc `WebSocket closed`
- Fix: **Đóng toàn bộ tab** `chat.zalo.me` → restart agent

### Cookie bị IP binding
- Cookie được liên kết với IP tạo ra lần đầu
- Nếu lấy cookie từ máy Việt Nam (IP VN) nhưng deploy lên Render US → Zalo từ chối
- Cách đúng: lấy cookie từ phiên đang chạy trên Render (không tạo session mới từ local)
- Hoặc: dùng VPN để IP máy local khớp với IP server khi lấy cookie

### 2 tài khoản chạy song song (Multi-instance)
Project đang chạy 2 Render service với 2 tài khoản Zalo khác nhau:
- Set biến `INSTANCE_ID=dealmonitor` trên service thứ 2
- Cookie sẽ được lưu vào DB key `zalo_cookie_dealmonitor` thay vì `zalo_cookie` chung → không ghi đè lẫn nhau

### `selfListen: false` trong production
- Nếu để `selfListen: true`, bot sẽ nhận tin nhắn của chính nó → vòng lặp vô hạn

### Lấy group ID để test
- Vào `chat.zalo.me` → mở group → copy phần số trong URL
- Hoặc chạy listener và in `message.data.idTo` khi có tin nhắn vào group đó

---

## 8. Debug & Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| `Another connection is opened` | Mở `chat.zalo.me` trên browser | Đóng tất cả tab chat.zalo.me → restart |
| WebSocket closed ngay khi start | Cookie cũ / expire | Lấy cookie mới → cập nhật .env → restart |
| `zpw_enk null` trong log | Cookie thiếu field | Re-extract đầy đủ qua J2TEAM extension |
| Bot không nhận @mention | `selfListen: false` + bot mention chính nó | Kiểm tra ownId có khớp không |
| Gửi tin lỗi "Nhóm không tồn tại" | Dùng `DirectMessage` cho group (hoặc ngược lại) | Dùng đúng `MessageType` theo loại chat |
| Cookie expire sau khi deploy lên Render | IP binding — session tạo từ IP VN không dùng được ở US | Reuse cookie từ session đang chạy trên Render |

---

## 9. Kiểm tra Session còn sống

```js
try {
  await api.getOwnId(); // OK → session còn
} catch {
  // Session expired
}
```

Project chạy health check tự động mỗi 30 phút trong `session.js`. Kết quả được ghi vào bảng `settings`:
- `session_status = 'ok'` — đang hoạt động
- `session_status = 'warning'` — health check fail (cảnh báo)
- `session_status = 'expired'` — session đã chết, cần lấy cookie mới
