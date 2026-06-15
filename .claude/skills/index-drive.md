# Skill: Index Google Drive

**Khi nào dùng**: Sau khi thêm tài liệu mới vào Drive, sau khi quota reset, hoặc khi `doc_chunks` table trống.

## Chạy indexer

```bash
cd /Users/thuycam/Desktop/GiftZone/giftzone-agent/agent
npm run index:drive
```

## Kiểm tra trước khi chạy

```bash
# 1. Kiểm tra pgvector container đang chạy
docker ps | grep pgvector

# 2. Kiểm tra quota còn không (nếu đã thất bại gần đây, đợi đến 7:00 SA giờ VN)
# 3. Kiểm tra DRIVE_FOLDER_ID trong .env trỏ đúng folder

# 4. Xem hiện tại có bao nhiêu chunks
psql -h localhost -p 5433 -U postgres -d giftzone_agent \
  -c "SELECT file_name, COUNT(*) as chunks FROM doc_chunks GROUP BY file_name ORDER BY file_name;"
```

## Kiểm tra sau khi chạy

```bash
psql -h localhost -p 5433 -U postgres -d giftzone_agent \
  -c "SELECT file_name, COUNT(*) as chunks, MAX(indexed_at) as last_indexed FROM doc_chunks GROUP BY file_name;"
```

## Xóa và reindex một file cụ thể

```bash
# Xóa chunks của file (dùng file_id từ Drive URL hoặc query DB)
psql -h localhost -p 5433 -U postgres -d giftzone_agent \
  -c "DELETE FROM doc_chunks WHERE file_name = 'tên-file.xlsx';"

# Sau đó chạy lại indexer — nó sẽ chỉ index file đó nếu là file duy nhất trong folder
# Hoặc nếu muốn reindex toàn bộ:
psql -h localhost -p 5433 -U postgres -d giftzone_agent \
  -c "TRUNCATE doc_chunks;"
npm run index:drive
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `429 Too Many Requests` | Quota embedding hết | Đợi reset lúc 7:00 SA; thêm `SKIP_INDEX=true` |
| `404 model not found` | Tên model sai | Phải là `gemini-embedding-001` |
| `expected 1536 dimensions` | Schema cũ khác dim | `DROP TABLE doc_chunks CASCADE` rồi restart agent để recreate |
| `0 files found` | `DRIVE_FOLDER_ID` sai | Kiểm tra ID là folder (không phải file) |
