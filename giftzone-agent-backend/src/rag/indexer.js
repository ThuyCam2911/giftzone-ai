/**
 * Google Drive Indexer
 * - Fetch files từ Drive folder
 * - Parse PDF / DOCX / XLSX / Google Docs / Sheets
 * - Chunk + embed + lưu vào pgvector
 * - Tự động re-index khi file thay đổi (polling Changes API mỗi 15 phút)
 */
import { google } from 'googleapis';
import fs from 'fs';
import os from 'os';
import path from 'path';
import 'dotenv/config';
import { embed } from './embedder.js';
import { query, initSchema } from '../utils/db.js';
import { getConfig, loadConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Indexer');

const CHUNK_SIZE  = 600;  // words per chunk
const CHUNK_OVERLAP = 60; // words overlap

// ─── OAuth2 ──────────────────────────────────────────────────────────────────
function createDriveClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

// ─── List files trong folder (hoặc chính file đó) ────────────────────────────
async function listFiles(drive) {
  const id = getConfig('drive_folder_id', process.env.DRIVE_FOLDER_ID);
  const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType' });
  const isFolder = meta.data.mimeType === 'application/vnd.google-apps.folder';

  if (isFolder) {
    const res = await drive.files.list({
      q: `'${id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: 100,
    });
    return res.data.files;
  }
  return [meta.data];
}

// ─── Parse file → text ────────────────────────────────────────────────────────
async function parseFile(drive, file) {
  const GOOGLE_EXPORT = {
    'application/vnd.google-apps.document':     'text/plain',
    'application/vnd.google-apps.spreadsheet':  'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
  };
  const OFFICE_EXPORT = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text/plain',
  };

  // Google native → export
  if (GOOGLE_EXPORT[file.mimeType]) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: GOOGLE_EXPORT[file.mimeType] },
      { responseType: 'text' }
    );
    return String(res.data);
  }

  // Office files được upload (có thể vẫn export được)
  if (OFFICE_EXPORT[file.mimeType]) {
    try {
      const res = await drive.files.export(
        { fileId: file.id, mimeType: OFFICE_EXPORT[file.mimeType] },
        { responseType: 'text' }
      );
      return String(res.data);
    } catch {}
  }

  // Download binary → parse
  const tmpPath = path.join(os.tmpdir(), `gz_${file.id}`);
  const dest = fs.createWriteStream(tmpPath);
  await new Promise((resolve, reject) => {
    drive.files
      .get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
      .then(res => { res.data.pipe(dest); res.data.on('end', resolve); res.data.on('error', reject); });
  });

  let text = '';
  if (file.mimeType === 'application/pdf') {
    const { default: pdfParse } = await import('pdf-parse');
    text = (await pdfParse(fs.readFileSync(tmpPath))).text;
  } else if (file.mimeType.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    text = (await mammoth.extractRawText({ path: tmpPath })).value;
  } else if (file.mimeType.includes('spreadsheetml')) {
    const XLSX = await import('xlsx');
    const lib = XLSX.default ?? XLSX;
    const wb = lib.readFile(tmpPath);
    text = wb.SheetNames.map(n => lib.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
  }
  fs.unlinkSync(tmpPath);
  return text;
}

// ─── Chunk text ───────────────────────────────────────────────────────────────
function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.length > 50) chunks.push(chunk);
    if (i + CHUNK_SIZE >= words.length) break;
  }
  return chunks;
}

// ─── Index một file ───────────────────────────────────────────────────────────
async function indexFile(drive, file) {
  log.info(`Indexing: ${file.name}`);
  const text = await parseFile(drive, file);
  if (!text || text.trim().length < 50) {
    log.warn(`${file.name}: nội dung quá ngắn, bỏ qua`);
    return 0;
  }

  const chunks = chunkText(text);
  log.info(`${file.name}: ${chunks.length} chunks`);

  // Xoá chunks cũ của file này
  await query('DELETE FROM doc_chunks WHERE file_id = $1', [file.id]);

  // Embed + insert tuần tự với 600ms delay giữa mỗi chunk (rate limit Gemini free tier)
  for (let i = 0; i < chunks.length; i++) {
    if (i % 10 === 0) log.info(`${file.name}: embedding chunk ${i + 1}/${chunks.length}...`);
    const vector = await embed(chunks[i]);
    await query(
      `INSERT INTO doc_chunks (file_id, file_name, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4, $5)`,
      [file.id, file.name, i, chunks[i], JSON.stringify(vector)]
    );
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  log.info(`${file.name}: indexed ${chunks.length} chunks ✓`);
  return chunks.length;
}

// ─── Full index tất cả files ─────────────────────────────────────────────────
export async function indexAll() {
  const drive = createDriveClient();
  const files = await listFiles(drive);
  log.info(`Tìm thấy ${files.length} file(s) cần index`);

  let total = 0;
  for (const file of files) {
    try {
      total += await indexFile(drive, file);
    } catch (err) {
      log.error(`Lỗi khi index ${file.name}`, err.message);
    }
  }
  log.info(`Index hoàn tất: ${total} chunks tổng cộng`);
  return total;
}

// ─── Auto-sync: poll Drive Changes API mỗi 15 phút ──────────────────────────
export async function startAutoSync() {
  const drive = createDriveClient();

  // Lấy pageToken ban đầu
  let pageToken = (await drive.changes.getStartPageToken()).data.startPageToken;
  log.info('Auto-sync started — polling mỗi 24 giờ');

  setInterval(async () => {
    try {
      const res = await drive.changes.list({
        pageToken,
        fields: 'nextPageToken,newStartPageToken,changes(fileId,file(name,mimeType,trashed))',
        spaces: 'drive',
      });

      const changes = res.data.changes ?? [];
      const relevant = changes.filter(c => !c.file?.trashed);

      if (relevant.length > 0) {
        log.info(`Auto-sync: ${relevant.length} file(s) thay đổi — re-index`);
        for (const change of relevant) {
          if (change.file) {
            await indexFile(drive, change.file).catch(e => log.error('Re-index lỗi', e.message));
          }
        }
      }

      pageToken = res.data.newStartPageToken ?? res.data.nextPageToken ?? pageToken;
    } catch (err) {
      log.error('Auto-sync poll lỗi', err.message);
    }
  }, 24 * 60 * 60 * 1000);
}

// ─── Chạy trực tiếp: node src/rag/indexer.js ─────────────────────────────────
if (process.argv[1]?.endsWith('indexer.js')) {
  await initSchema();
  await loadConfig();
  await indexAll();
  process.exit(0);
}
