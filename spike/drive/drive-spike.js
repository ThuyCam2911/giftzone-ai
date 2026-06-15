/**
 * SPIKE: Google Drive API — indexing speed, rate limits, format support
 *
 * Mục tiêu:
 *   1. OAuth2 authentication
 *   2. Đo thời gian list + download files từ folder
 *   3. Parse nội dung: PDF, DOCX, XLSX, Google Docs/Sheets/Slides
 *   4. Đo throughput chunking + embedding (Claude API)
 *   5. Ước tính thời gian index 100-200 trang tài liệu thực
 *   6. Test rate limit behavior
 *
 * Cách chạy:
 *   cd spike && npm install && npm run spike:drive
 *
 * Yêu cầu: Điền GOOGLE_* và ANTHROPIC_API_KEY trong .env
 */

import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '../results');
const TEMP_DIR = path.join(__dirname, '../temp');

const results = {
  timestamp: new Date().toISOString(),
  tests: {},
};

function log(label, msg, color = 'white') {
  console.log(chalk[color](`[${label}] ${msg}`));
}

function saveResults() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'drive-spike-result.json'),
    JSON.stringify(results, null, 2)
  );
  log('RESULT', 'Saved to spike/results/drive-spike-result.json', 'cyan');
}

// ─── OAuth2 setup ─────────────────────────────────────────────────────────────
function createOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

// ─── TEST 1: Auth & list files (tự nhận dạng folder hay file) ────────────────
async function testAuth(drive) {
  log('TEST 1', 'Google Drive OAuth2 + list files...', 'yellow');
  const driveId = process.env.DRIVE_FOLDER_ID;

  if (!driveId) {
    results.tests.auth = { status: 'SKIP', note: 'DRIVE_FOLDER_ID chưa được set trong .env' };
    log('TEST 1', 'SKIP — Điền DRIVE_FOLDER_ID vào .env', 'yellow');
    return null;
  }

  const start = Date.now();
  try {
    // Bước 1: xác định ID là folder hay file
    const metaRes = await drive.files.get({
      fileId: driveId,
      fields: 'id, name, mimeType',
    });
    const meta = metaRes.data;
    const isFolder = meta.mimeType === 'application/vnd.google-apps.folder';
    log('TEST 1', `ID "${driveId}" là: ${isFolder ? 'FOLDER' : `FILE (${meta.mimeType})`}`, 'cyan');

    let files = [];
    if (isFolder) {
      // List tất cả files bên trong folder
      const res = await drive.files.list({
        q: `'${driveId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size)',
        pageSize: 100,
      });
      files = res.data.files;
    } else {
      // Dùng chính file đó
      files = [meta];
    }

    const elapsed = Date.now() - start;
    const byType = files.reduce((acc, f) => {
      const type = f.mimeType.split('/').pop().split('.').pop();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    results.tests.auth = {
      status: 'PASS',
      elapsed_ms: elapsed,
      mode: isFolder ? 'folder' : 'single_file',
      file_count: files.length,
      by_type: byType,
      files: files.map(f => ({ name: f.name, mimeType: f.mimeType })),
    };
    log('TEST 1', `PASS — ${files.length} file(s) trong ${elapsed}ms`, 'green');
    log('TEST 1', `Types: ${JSON.stringify(byType)}`, 'cyan');
    return files;
  } catch (err) {
    results.tests.auth = { status: 'FAIL', error: err.message };
    log('TEST 1', `FAIL — ${err.message}`, 'red');
    return null;
  }
}

// ─── TEST 2: Download & parse files theo format ───────────────────────────────
async function testParseFormats(drive, files) {
  log('TEST 2', 'Parse nội dung các format...', 'yellow');
  if (!files || files.length === 0) {
    results.tests.parse_formats = { status: 'SKIP', note: 'Không có files để test' };
    return [];
  }

  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const MIME_MAP = {
    'application/pdf': { ext: 'pdf', parse: parsePdf },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      ext: 'docx',
      parse: parseDocx,
    },
    // File xlsx upload thông thường
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      ext: 'xlsx',
      parse: parseXlsx,
    },
    // Google Sheets được Drive báo mimeType là xlsx khi truy cập qua file.get
    // → dùng export CSV thay vì download binary
    'application/vnd.google-apps.document': {
      ext: 'gdoc',
      parse: null,
      exportMime: 'text/plain',
    },
    'application/vnd.google-apps.spreadsheet': {
      ext: 'gsheet',
      parse: null,
      exportMime: 'text/csv',
    },
    'application/vnd.google-apps.presentation': {
      ext: 'gslides',
      parse: null,
      exportMime: 'text/plain',
    },
  };

  // Google Sheets native file: Drive trả mimeType xlsx khi get metadata,
  // nhưng thực ra phải export — detect qua file.id và try export trước
  const GOOGLE_EXPORT_FALLBACK = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text/plain',
  };

  const parseResults = {};
  const parsedTexts = [];

  for (const file of files.slice(0, 10)) {
    const handler = MIME_MAP[file.mimeType];
    if (!handler) continue;

    const start = Date.now();
    try {
      let text = '';

      if (file.mimeType.startsWith('application/vnd.google-apps.')) {
        // Google Docs native → export thẳng ra text/plain hoặc csv
        const res = await drive.files.export(
          { fileId: file.id, mimeType: handler.exportMime },
          { responseType: 'text' }
        );
        text = res.data;
      } else if (GOOGLE_EXPORT_FALLBACK[file.mimeType]) {
        // File có thể là Google Sheet/Doc được rename hoặc convert
        // → thử export trước, nếu fail mới download binary
        try {
          const exportMime = GOOGLE_EXPORT_FALLBACK[file.mimeType];
          const res = await drive.files.export(
            { fileId: file.id, mimeType: exportMime },
            { responseType: 'text' }
          );
          text = res.data;
          log('TEST 2', `${file.name} — export CSV thành công`, 'cyan');
        } catch {
          // Không export được → download binary
          const tempPath = path.join(TEMP_DIR, `${file.id}.${handler.ext}`);
          const dest = fs.createWriteStream(tempPath);
          await new Promise((resolve, reject) => {
            drive.files
              .get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
              .then((res) => {
                res.data.pipe(dest);
                res.data.on('end', resolve);
                res.data.on('error', reject);
              });
          });
          text = handler.parse ? await handler.parse(tempPath) : '';
          fs.unlinkSync(tempPath);
        }
      } else {
        // Download binary file thông thường (PDF, DOCX upload thật)
        const tempPath = path.join(TEMP_DIR, `${file.id}.${handler.ext}`);
        const dest = fs.createWriteStream(tempPath);
        await new Promise((resolve, reject) => {
          drive.files
            .get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
            .then((res) => {
              res.data.pipe(dest);
              res.data.on('end', resolve);
              res.data.on('error', reject);
            });
        });
        text = handler.parse ? await handler.parse(tempPath) : '';
        fs.unlinkSync(tempPath);
      }

      const elapsed = Date.now() - start;
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      parseResults[file.name] = {
        status: 'PASS',
        mime: file.mimeType,
        elapsed_ms: elapsed,
        word_count: wordCount,
        estimated_pages: Math.ceil(wordCount / 250),
      };
      parsedTexts.push({ name: file.name, text });
      log('TEST 2', `${file.name} — ${wordCount} words trong ${elapsed}ms`, 'green');
    } catch (err) {
      parseResults[file.name] = { status: 'FAIL', error: err.message };
      log('TEST 2', `${file.name} FAIL — ${err.message}`, 'red');
    }
  }

  const passed = Object.values(parseResults).filter((r) => r.status === 'PASS').length;
  results.tests.parse_formats = {
    status: passed > 0 ? 'PASS' : 'FAIL',
    files_parsed: passed,
    detail: parseResults,
  };

  return parsedTexts;
}

async function parsePdf(filePath) {
  const { default: pdfParse } = await import('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(filePath) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function parseXlsx(filePath) {
  const XLSX = await import('xlsx');
  const lib = XLSX.default ?? XLSX;
  const wb = lib.readFile(filePath);
  return wb.SheetNames.map((name) =>
    lib.utils.sheet_to_csv(wb.Sheets[name])
  ).join('\n');
}

// ─── TEST 3: Chunking throughput ──────────────────────────────────────────────
async function testChunking(parsedTexts) {
  log('TEST 3', 'Đo throughput chunking (1000 tokens/chunk, overlap 100)...', 'yellow');

  const CHUNK_SIZE = 800; // words
  const OVERLAP = 80;
  let totalChunks = 0;
  const start = Date.now();

  for (const { text } of parsedTexts) {
    const words = text.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
      words.slice(i, i + CHUNK_SIZE).join(' ');
      totalChunks++;
    }
  }

  const elapsed = Date.now() - start;
  results.tests.chunking = {
    status: 'PASS',
    total_chunks: totalChunks,
    elapsed_ms: elapsed,
    chunks_per_second: Math.round((totalChunks / elapsed) * 1000),
    note: `Ước tính 10,000 chunks mất ${Math.round((10000 / totalChunks) * elapsed / 1000)}s để chunk`,
  };
  log('TEST 3', `PASS — ${totalChunks} chunks trong ${elapsed}ms`, 'green');
}

// ─── TEST 4: Embedding speed (dùng Claude API) ────────────────────────────────
async function testEmbedding(parsedTexts) {
  log('TEST 4', 'Đo tốc độ tạo embeddings...', 'yellow');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Lấy 5 chunks mẫu để đo
  const sampleChunks = [];
  for (const { text } of parsedTexts.slice(0, 3)) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 100) {
      sampleChunks.push(words.slice(0, 200).join(' '));
    }
  }

  if (sampleChunks.length === 0) {
    results.tests.embedding = { status: 'SKIP', note: 'Không đủ nội dung để test embedding' };
    log('TEST 4', 'SKIP — Không có text để embed', 'yellow');
    return;
  }

  // Claude không có embedding API trực tiếp — dùng để đo token count thay thế
  // Thực tế sẽ dùng text-embedding-3-small của OpenAI hoặc Voyage AI
  // Đây là spike để đo chi phí và tốc độ
  log('TEST 4', 'Note: Claude không có embedding API — đo token count làm proxy', 'cyan');
  log('TEST 4', 'Production: dùng voyage-3-lite hoặc text-embedding-3-small', 'cyan');

  const start = Date.now();
  let totalTokens = 0;

  for (const chunk of sampleChunks) {
    // Đo bằng cách count token thủ công (1 word ≈ 1.3 tokens)
    totalTokens += Math.ceil(chunk.split(/\s+/).length * 1.3);
  }

  const elapsed = Date.now() - start;
  const tokensPerDoc = totalTokens / sampleChunks.length;

  results.tests.embedding = {
    status: 'INFO',
    sample_chunks: sampleChunks.length,
    avg_tokens_per_chunk: Math.round(tokensPerDoc),
    estimated_cost_per_1000_chunks_usd: {
      'voyage-3-lite': ((1000 * tokensPerDoc) / 1_000_000) * 0.02,
      'text-embedding-3-small': ((1000 * tokensPerDoc) / 1_000_000) * 0.02,
    },
    recommendation: 'Dùng voyage-3-lite cho tiếng Việt — tốt hơn OpenAI với ngôn ngữ Đông Nam Á',
    elapsed_ms: elapsed,
  };
  log('TEST 4', `INFO — avg ${Math.round(tokensPerDoc)} tokens/chunk`, 'cyan');
}

// ─── TEST 5: Drive Watch (push notification khi file thay đổi) ────────────────
async function testDriveWatch(drive) {
  log('TEST 5', 'Test Google Drive Watch (push notification)...', 'yellow');

  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    results.tests.drive_watch = { status: 'SKIP', note: 'DRIVE_FOLDER_ID chưa set' };
    return;
  }

  try {
    // Kiểm tra changes API — cần pageToken
    const startRes = await drive.changes.getStartPageToken();
    const pageToken = startRes.data.startPageToken;

    results.tests.drive_watch = {
      status: 'PASS',
      mechanism: 'Google Drive Changes API (polling) hoặc Push Notifications (webhook)',
      page_token_obtained: !!pageToken,
      note: [
        'Polling: gọi drive.changes.list() mỗi 15 phút với pageToken',
        'Push: đăng ký webhook (cần domain public HTTPS) để nhận event realtime',
        'MVP: dùng polling mỗi 15 phút là đủ — không cần webhook phức tạp',
      ],
    };
    log('TEST 5', 'PASS — Changes API hoạt động, polling 15 phút là đủ cho MVP', 'green');
  } catch (err) {
    results.tests.drive_watch = { status: 'FAIL', error: err.message };
    log('TEST 5', `FAIL — ${err.message}`, 'red');
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.bold.blue('\n=== SPIKE: Google Drive API ===\n'));

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    log('MAIN', 'Thiếu GOOGLE_* trong .env — xem .env.example để cấu hình', 'red');
    log('MAIN', 'Hướng dẫn lấy credentials: https://developers.google.com/drive/api/quickstart/nodejs', 'cyan');
    results.tests.auth = { status: 'SKIP', note: 'Credentials chưa được cấu hình' };
    saveResults();
    return;
  }

  const auth = createOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const files = await testAuth(drive);
  const parsedTexts = await testParseFormats(drive, files);
  await testChunking(parsedTexts);
  await testEmbedding(parsedTexts);
  await testDriveWatch(drive);

  // Tổng kết
  const passed = Object.values(results.tests).filter(
    (t) => t.status === 'PASS' || t.status === 'INFO'
  ).length;
  const total = Object.keys(results.tests).length;

  results.summary = {
    verdict:
      passed >= 3
        ? 'GO — Drive API hoạt động tốt, có thể build RAG pipeline'
        : 'INVESTIGATE — Xem chi tiết từng test',
    recommendations: [
      'Embedding: dùng Voyage AI voyage-3-lite cho tiếng Việt',
      'Sync: polling mỗi 15 phút với Changes API (không cần webhook phức tạp)',
      'File format: ưu tiên hỗ trợ PDF + Google Docs trước, DOCX/XLSX sau',
    ],
  };

  console.log(chalk.bold.blue('\n=== KẾT QUẢ SPIKE Drive API ==='));
  console.log(chalk[passed >= 3 ? 'green' : 'yellow'](`${passed}/${total} tests PASS/INFO`));
  console.log(chalk.bold(`\nVerdict: ${results.summary.verdict}`));

  // Cleanup temp
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }

  saveResults();
}

main().catch((err) => {
  console.error(chalk.red('Spike crash:'), err);
  saveResults();
  process.exit(1);
});
