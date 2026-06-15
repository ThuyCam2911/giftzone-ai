# Skill: Thêm tính năng mới vào Agent

**Khi nào dùng**: Khi cần thêm command mới, handler mới, hoặc background job mới.

## Checklist thêm tính năng

### 1. Xác định loại tính năng

| Loại | File cần sửa/tạo |
|------|-----------------|
| @mention command mới (VD: `@agent tóm tắt deal`) | `zalo/responder.js` + `rag/retriever.js` |
| Background job mới (VD: monthly summary) | `summary/engine.js` |
| Nguồn dữ liệu mới (VD: Notion) | `rag/indexer.js` |
| Table DB mới | `utils/db.js` → `initSchema()` |
| Startup step mới | `index.js` |

### 2. Pattern thêm command vào responder

```js
// src/zalo/responder.js
async handle(ctx) {
  const { query, groupId, senderName } = ctx;

  // Detect command
  if (query.toLowerCase().startsWith('tóm tắt deal')) {
    await this._handleBriefing(ctx);
    return;
  }

  // Default: RAG query
  await this._handleRagQuery(ctx);
}

async _handleBriefing(ctx) {
  await this.api.sendMessage({ msg: '📋 Đang tổng hợp deal...' }, ctx.groupId, MessageType.GroupMessage);
  // ... logic
}
```

### 3. Pattern thêm cron job

```js
// src/summary/engine.js
export function startSummaryEngine(api) {
  // Existing jobs...

  // Monthly summary: cuối tháng
  cron.schedule('0 17 28-31 * *', async () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDate() === 1) {  // Ngày cuối tháng
      await runMonthlySummary(api).catch(err => log.error('Monthly summary crash', err.message));
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });
}
```

### 4. Pattern thêm table DB

```js
// src/utils/db.js → initSchema()
await query(`
  CREATE TABLE IF NOT EXISTS deal_stages (
    id          BIGSERIAL PRIMARY KEY,
    group_id    TEXT NOT NULL UNIQUE,
    stage       TEXT NOT NULL DEFAULT 'Mới',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )
`);
```

### 5. Wire vào index.js

```js
// src/index.js — chỉ thêm vào bước phù hợp
import { newFeature } from './path/to/module.js';

// Trong main():
// Bước 5 nếu là background job
newFeature(api).catch(err => log.warn('Feature lỗi', err.message));
```

## Testing tính năng mới

```bash
# Dev mode với auto-restart
cd agent && npm run dev

# Gửi @mention test vào group 6598808947011857265
# Xem log trong terminal
# Kiểm tra DB nếu cần
psql -h localhost -p 5433 -U postgres -d giftzone_agent -c "SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT 5;"
```
