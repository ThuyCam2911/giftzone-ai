# Skill: Debug RAG Pipeline

**Khi nào dùng**: Agent trả lời sai, không tìm được thông tin, hoặc reply "Tôi chưa có tài liệu".

## Kiểm tra từng layer

### Layer 1: Có chunks trong DB không?

```bash
psql -h localhost -p 5433 -U postgres -d giftzone_agent \
  -c "SELECT file_name, COUNT(*) as chunks FROM doc_chunks GROUP BY file_name;"
```

Nếu trống → chạy `npm run index:drive` (sau khi quota reset).

### Layer 2: Embedding dimension khớp không?

```bash
psql -h localhost -p 5433 -U postgres -d giftzone_agent \
  -c "SELECT vector_dims(embedding) FROM doc_chunks LIMIT 1;"
```

Phải trả về `1536`. Nếu khác → `DROP TABLE doc_chunks CASCADE;` rồi restart agent.

### Layer 3: Similarity search có trả kết quả không?

```bash
# Chạy query thử với random vector 1536 dims
psql -h localhost -p 5433 -U postgres -d giftzone_agent -c "
SELECT file_name, content, 1 - (embedding <=> embedding) AS self_sim
FROM doc_chunks LIMIT 3;"
```

### Layer 4: Test embed một câu

```js
// Tạo file test-embed.js tạm thời
import 'dotenv/config';
import { embed } from './src/rag/embedder.js';

const vec = await embed('bảng giá gói Enterprise');
console.log('Dim:', vec.length);  // Phải là 1536
console.log('First 3:', vec.slice(0, 3));
process.exit(0);
```

```bash
cd agent && node test-embed.js
```

### Layer 5: Test full RAG query

```js
// test-rag.js tạm thời
import 'dotenv/config';
import { answer } from './src/rag/retriever.js';

const result = await answer('bảng giá gói Enterprise là bao nhiêu?');
console.log('Answer:', result.answer);
console.log('Sources:', result.sources);
console.log('Latency:', result.latency_ms, 'ms');
process.exit(0);
```

```bash
cd agent && node test-rag.js
```

## Kiểm tra AI logs (xem agent đã reply gì)

```bash
psql -h localhost -p 5433 -U postgres -d giftzone_agent -c "
SELECT
  created_at,
  sender_uid,
  query,
  LEFT(answer, 100) AS answer_preview,
  sources,
  latency_ms
FROM ai_logs
ORDER BY created_at DESC
LIMIT 10;"
```

## Kiểm tra messages (xem agent có nhận tin không)

```bash
psql -h localhost -p 5433 -U postgres -d giftzone_agent -c "
SELECT sender_name, content, msg_ts
FROM messages
ORDER BY msg_ts DESC
LIMIT 20;"
```
