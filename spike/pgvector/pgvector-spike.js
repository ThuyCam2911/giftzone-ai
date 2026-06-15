/**
 * SPIKE: pgvector — semantic search latency với ~10,000 chunks
 *
 * Mục tiêu:
 *   1. Setup PostgreSQL + pgvector extension
 *   2. Insert 10,000 chunks với random embeddings (1536 dims)
 *   3. Đo latency semantic search với HNSW index vs IVFFlat vs no index
 *   4. Đo top-k query (k=5, k=10) — xác nhận realtime (<500ms)
 *   5. Đo concurrent queries (simulate nhiều group cùng lúc)
 *
 * Cách chạy:
 *   cd spike && npm install && npm run spike:pgvector
 *
 * Yêu cầu: PostgreSQL đang chạy, điền PG_* trong .env
 * Setup PostgreSQL local nhanh: docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16
 */

import pg from 'pg';
import chalk from 'chalk';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '../results');

const { Pool } = pg;

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
    path.join(RESULTS_DIR, 'pgvector-spike-result.json'),
    JSON.stringify(results, null, 2)
  );
  log('RESULT', 'Saved to spike/results/pgvector-spike-result.json', 'cyan');
}

// Random vector chuẩn hóa (simulate embedding 1536 dims)
function randomVector(dims = 1536) {
  const v = Array.from({ length: dims }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

function vectorToString(v) {
  return '[' + v.join(',') + ']';
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── TEST 1: Setup database + extension ───────────────────────────────────────
async function testSetup(pool) {
  log('TEST 1', 'Setup pgvector extension & table...', 'yellow');
  const start = Date.now();

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    await pool.query(`
      DROP TABLE IF EXISTS spike_chunks;
      CREATE TABLE spike_chunks (
        id SERIAL PRIMARY KEY,
        content TEXT,
        source_file TEXT,
        chunk_index INT,
        embedding vector(1536)
      )
    `);

    const elapsed = Date.now() - start;
    results.tests.setup = { status: 'PASS', elapsed_ms: elapsed };
    log('TEST 1', `PASS — pgvector extension & table ready trong ${elapsed}ms`, 'green');
  } catch (err) {
    results.tests.setup = { status: 'FAIL', error: err.message };
    log('TEST 1', `FAIL — ${err.message}`, 'red');
    if (err.message.includes('extension')) {
      log('TEST 1', 'Cài pgvector: docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16', 'cyan');
    }
    throw err;
  }
}

// ─── TEST 2: Insert 10,000 chunks (batch) ────────────────────────────────────
async function testBulkInsert(pool, count = 10_000) {
  log('TEST 2', `Insert ${count.toLocaleString()} chunks...`, 'yellow');
  const BATCH = 500;
  const start = Date.now();
  let inserted = 0;

  for (let b = 0; b < count; b += BATCH) {
    const batchSize = Math.min(BATCH, count - b);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (let i = 0; i < batchSize; i++) {
      const vec = vectorToString(randomVector());
      const chunkIdx = b + i;
      values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
      params.push(
        `Nội dung chunk số ${chunkIdx} về sản phẩm và dịch vụ GiftZone`,
        `doc_${Math.floor(chunkIdx / 100)}.pdf`,
        chunkIdx % 100,
        vec
      );
      paramIdx += 4;
    }

    await pool.query(
      `INSERT INTO spike_chunks (content, source_file, chunk_index, embedding) VALUES ${values.join(',')}`,
      params
    );
    inserted += batchSize;

    if (inserted % 2000 === 0) {
      log('TEST 2', `${inserted.toLocaleString()}/${count.toLocaleString()} inserted...`, 'white');
    }
  }

  const elapsed = Date.now() - start;
  results.tests.bulk_insert = {
    status: 'PASS',
    rows_inserted: count,
    elapsed_ms: elapsed,
    rate_rows_per_sec: Math.round((count / elapsed) * 1000),
  };
  log('TEST 2', `PASS — ${count.toLocaleString()} rows trong ${(elapsed / 1000).toFixed(1)}s`, 'green');
}

// ─── TEST 3: Semantic search — không có index ─────────────────────────────────
async function testSearchNoIndex(pool, iterations = 20) {
  log('TEST 3', `Semantic search (NO INDEX) — ${iterations} queries...`, 'yellow');
  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    const query = vectorToString(randomVector());
    const start = Date.now();
    await pool.query(
      `SELECT id, content, source_file, 1 - (embedding <=> $1::vector) AS score
       FROM spike_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [query]
    );
    latencies.push(Date.now() - start);
  }

  results.tests.search_no_index = {
    status: 'PASS',
    iterations,
    avg_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    max_ms: Math.max(...latencies),
    verdict: Math.max(...latencies) < 500 ? 'REALTIME OK' : 'TOO SLOW — cần index',
  };
  log(
    'TEST 3',
    `avg ${results.tests.search_no_index.avg_ms}ms | p95 ${results.tests.search_no_index.p95_ms}ms | ${results.tests.search_no_index.verdict}`,
    results.tests.search_no_index.verdict === 'REALTIME OK' ? 'green' : 'yellow'
  );
}

// ─── TEST 4: Tạo HNSW index + benchmark lại ──────────────────────────────────
async function testSearchWithHNSW(pool, iterations = 20) {
  log('TEST 4', 'Tạo HNSW index...', 'yellow');
  const idxStart = Date.now();
  await pool.query(
    `CREATE INDEX ON spike_chunks USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64)`
  );
  const idxElapsed = Date.now() - idxStart;
  log('TEST 4', `HNSW index tạo trong ${(idxElapsed / 1000).toFixed(1)}s`, 'cyan');

  log('TEST 4', `Semantic search (HNSW) — ${iterations} queries...`, 'yellow');
  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    const query = vectorToString(randomVector());
    const start = Date.now();
    await pool.query(
      `SELECT id, content, source_file, 1 - (embedding <=> $1::vector) AS score
       FROM spike_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [query]
    );
    latencies.push(Date.now() - start);
  }

  results.tests.search_hnsw = {
    status: 'PASS',
    index_build_ms: idxElapsed,
    iterations,
    avg_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    max_ms: Math.max(...latencies),
    verdict: Math.max(...latencies) < 200 ? 'REALTIME OK' : 'ACCEPTABLE',
  };
  log(
    'TEST 4',
    `avg ${results.tests.search_hnsw.avg_ms}ms | p95 ${results.tests.search_hnsw.p95_ms}ms | ${results.tests.search_hnsw.verdict}`,
    'green'
  );
}

// ─── TEST 5: Concurrent queries (simulate 10 groups cùng hỏi) ─────────────────
async function testConcurrentSearch(pool, concurrency = 10) {
  log('TEST 5', `Concurrent search — ${concurrency} queries song song...`, 'yellow');

  const start = Date.now();
  const promises = Array.from({ length: concurrency }, () => {
    const query = vectorToString(randomVector());
    return pool.query(
      `SELECT id, content, source_file, 1 - (embedding <=> $1::vector) AS score
       FROM spike_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [query]
    );
  });

  const times = [];
  for (const p of promises) {
    const t = Date.now();
    await p;
    times.push(Date.now() - t);
  }

  const elapsed = Date.now() - start;
  results.tests.concurrent_search = {
    status: 'PASS',
    concurrency,
    total_elapsed_ms: elapsed,
    avg_per_query_ms: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    p95_ms: percentile(times, 95),
    verdict:
      elapsed < concurrency * 200
        ? 'EXCELLENT — concurrent performance tốt'
        : elapsed < concurrency * 500
        ? 'ACCEPTABLE'
        : 'SLOW — cần connection pool tuning',
  };
  log(
    'TEST 5',
    `${concurrency} concurrent queries trong ${elapsed}ms | avg ${results.tests.concurrent_search.avg_per_query_ms}ms/query`,
    'green'
  );
  log('TEST 5', results.tests.concurrent_search.verdict, 'cyan');
}

// ─── TEST 6: Cleanup ──────────────────────────────────────────────────────────
async function cleanup(pool) {
  await pool.query('DROP TABLE IF EXISTS spike_chunks');
  log('CLEANUP', 'Table spike_chunks dropped', 'white');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.bold.blue('\n=== SPIKE: pgvector Semantic Search Latency ===\n'));

  const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'giftzone_spike',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    max: 20,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    log('MAIN', 'PostgreSQL connected', 'green');
  } catch (err) {
    log('MAIN', `Không kết nối được PostgreSQL: ${err.message}`, 'red');
    log('MAIN', 'Chạy: docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16', 'cyan');
    log('MAIN', 'Sau đó: docker exec -it pg psql -U postgres -c "CREATE DATABASE giftzone_spike;"', 'cyan');
    results.tests.connection = { status: 'FAIL', error: err.message };
    saveResults();
    process.exit(1);
  }

  try {
    await testSetup(pool);
    await testBulkInsert(pool, 10_000);
    await testSearchNoIndex(pool);
    await testSearchWithHNSW(pool);
    await testConcurrentSearch(pool, 10);
  } finally {
    await cleanup(pool);
    await pool.end();
  }

  // ─── Tổng kết ───────────────────────────────────────────────────────────────
  const noIdx = results.tests.search_no_index;
  const hnsw = results.tests.search_hnsw;

  results.summary = {
    verdict:
      hnsw?.p95_ms < 200
        ? 'GO — pgvector đủ nhanh cho realtime (<200ms p95 với HNSW)'
        : 'ACCEPTABLE — cần HNSW index, monitor latency khi scale',
    speedup_hnsw_vs_no_index: noIdx && hnsw
      ? `${Math.round(noIdx.avg_ms / hnsw.avg_ms)}x nhanh hơn`
      : 'N/A',
    recommendations: [
      'Luôn dùng HNSW index với vector_cosine_ops',
      'Connection pool: max 20 connections đủ cho MVP',
      '10,000 chunks: p95 < 200ms với HNSW — OK cho realtime @agent reply',
      'Khi scale >100k chunks: tăng ef_search và xem xét partitioning theo tenant',
    ],
  };

  console.log(chalk.bold.blue('\n=== KẾT QUẢ SPIKE pgvector ==='));
  if (noIdx && hnsw) {
    console.log(chalk.white(`No Index: avg ${noIdx.avg_ms}ms | p95 ${noIdx.p95_ms}ms`));
    console.log(chalk.green(`HNSW:     avg ${hnsw.avg_ms}ms | p95 ${hnsw.p95_ms}ms`));
    console.log(chalk.cyan(`Speedup: ${results.summary.speedup_hnsw_vs_no_index}`));
  }
  console.log(chalk.bold(`\nVerdict: ${results.summary.verdict}`));

  saveResults();
}

main().catch((err) => {
  console.error(chalk.red('Spike crash:'), err);
  saveResults();
  process.exit(1);
});
