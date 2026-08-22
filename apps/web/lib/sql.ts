/**
 * Kết nối Postgres.
 *
 * Hai driver, cùng một phương ngữ SQL:
 *   - có DATABASE_URL → `pg` nối tới Postgres thật (production)
 *   - không có        → PGlite, chính Postgres biên dịch sang WASM, chạy trong
 *                       tiến trình và ghi vào `.data/pg` (dev/test)
 *
 * PGlite không phải bản mô phỏng: nó là Postgres thật, nên SQL viết ở đây chạy
 * được ở cả hai nơi mà không cần nhánh riêng. Đổi lại, dev không cần cài gì.
 *
 * Lưu ý về đóng gói: cả `pg` lẫn `@electric-sql/pglite` phải nằm trong
 * `config.externals` (xem next.config.mjs). Để webpack bundle PGlite vào thì bộ
 * nhớ WASM của nó đi qua bộ serialize của Next, và mọi trang trả 500 với lỗi
 * "ArrayBuffer is not detachable and could not be cloned".
 */

import { readFile } from 'node:fs/promises';
import { assertConfig } from './config-check';
import { join } from 'node:path';

export interface QueryResult<T> {
  rows: T[];
}

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Chạy một loạt câu lệnh trong cùng transaction */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

// ─────────────────────────── pg ───────────────────────────

async function createPgClient(url: string): Promise<Sql> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: url,
    // Nếu DATABASE_URL trỏ tới PGlite chạy dạng server socket thì phải đặt
    // PG_POOL_MAX=1: nó chỉ phục vụ một kết nối tại một thời điểm và sẽ reset
    // (ECONNRESET) khi pool mở rộng hơn.
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });

  const wrap = (runner: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Sql => ({
    query: async (text, params) => ({ rows: (await runner.query(text, params)).rows as never[] }),
    transaction: async (fn) => fn(wrap(runner)),
  });

  return {
    query: async (text, params) => ({ rows: (await pool.query(text, params)).rows as never[] }),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(wrap(client));
        await client.query('commit');
        return result;
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

// ─────────────────────────── PGlite ───────────────────────────

async function createPgliteClient(dataDir: string): Promise<Sql> {
  const { PGlite } = await import('@electric-sql/pglite');
  // "memory://" = chạy hoàn toàn trong RAM (dùng cho test)
  const db = await PGlite.create(dataDir === 'memory://' ? undefined : { dataDir });

  const self: Sql = {
    query: async (text, params) => ({ rows: (await db.query(text, params)).rows as never[] }),
    // PGlite chạy một kết nối duy nhất nên transaction lồng nhau sẽ hỏng;
    // ở đây chỉ cần một mức, đủ cho các thao tác nhiều bảng.
    transaction: async (fn) => db.transaction(async (tx) => {
      const inner: Sql = {
        query: async (text, params) => ({ rows: (await tx.query(text, params)).rows as never[] }),
        transaction: async (nested) => nested(inner),
      };
      return fn(inner);
    }) as Promise<never>,
  };

  return self;
}

// ─────────────────────────── Khởi tạo một lần ───────────────────────────

let ready: Promise<Sql> | null = null;

export function getSql(): Promise<Sql> {
  ready ??= connect();
  return ready;
}

/** Chỉ dùng trong test: quên kết nối cũ để lần sau đọc lại biến môi trường */
export function resetSql(): void {
  ready = null;
}

/**
 * Mô tả nơi `DATABASE_URL` trỏ tới, đủ để chẩn đoán mà không lộ bí mật: chỉ
 * host, cổng và tên database — user và mật khẩu không bao giờ đi ra ngoài.
 *
 * Cần vì khi chuỗi kết nối bị dán sai (thiếu một đoạn, hoặc mật khẩu chứa ký tự
 * đặc biệt chưa percent-encode), driver chỉ kêu "ENOTFOUND <host lạ>" — không
 * nói được là chuỗi hỏng chỗ nào, mà biến môi trường thì thường đã bị đánh dấu
 * nhạy cảm nên không ai đọc lại được để đối chiếu.
 */
export function describeDatabaseUrl(url = process.env.DATABASE_URL): string {
  if (!url) return 'PGlite nhúng (không đặt DATABASE_URL)';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'DATABASE_URL không phải URL hợp lệ (ký tự đặc biệt trong mật khẩu phải percent-encode)';
  }

  const database = parsed.pathname.replace(/^\//, '') || '(thiếu tên database)';
  return `${parsed.hostname || '(thiếu host)'}:${parsed.port || '(thiếu cổng)'}/${database}`;
}

async function connect(): Promise<Sql> {
  // Kiểm cấu hình ngay lần chạm database đầu tiên: production thiếu biến thì
  // ném lỗi ở đây, còn hơn để khách mời phát hiện hộ.
  assertConfig();

  const url = process.env.DATABASE_URL;
  const sql = url
    ? await createPgClient(url)
    : await createPgliteClient(process.env.PGLITE_DIR ?? join(process.cwd(), '.data', 'pg'));

  await migrate(sql);
  await seedIfEmpty(sql);
  return sql;
}

/**
 * Seed khi database còn trống. Nạp `./seed` bằng dynamic import để module này
 * không kéo `node:crypto` (qua auth) vào đồ thị phụ thuộc tĩnh.
 */
async function seedIfEmpty(sql: Sql): Promise<void> {
  const { rows } = await sql.query<{ count: string }>('select count(*)::text as count from users');
  if (rows[0]?.count !== '0') return;

  const { seedDatabase } = await import('./seed');
  const data = await seedDatabase();

  await sql.transaction(async (tx) => {
    for (const u of data.users) {
      await tx.query(
        `insert into users (id, email, name, password_hash, role, created_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [u.id, u.email, u.name, u.passwordHash, u.role, u.createdAt],
      );
    }
    // Ảnh mồi phải vào trước template: template trỏ tới key của chúng, và
    // `/api/assets/...` tra bảng này trước khi đọc byte — thiếu hàng thì ảnh
    // có nằm trong kho cũng trả 404.
    for (const a of data.assets) {
      await tx.query(
        `insert into assets (id, key, owner_id, mime, width, height, bytes, original_name, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [a.id, a.key, a.ownerId, a.mime, a.width, a.height, a.bytes, a.originalName, a.createdAt],
      );
    }
    for (const t of data.templates) {
      await tx.query(
        `insert into templates (id, slug, name, owner_id, doc_packed, thumbnail, usage_count, revision)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [t.id, t.slug, t.name, t.ownerId, t.docPacked, t.thumbnail, t.usageCount, t.revision],
      );
    }
    for (const i of data.invites) {
      await tx.query(
        `insert into invites (id, slug, owner_id, template_id, data, published_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [i.id, i.slug, i.ownerId, i.templateId, JSON.stringify(i.data), i.publishedAt],
      );
    }
  });
}

async function migrate(sql: Sql): Promise<void> {
  // Đọc từ file thay vì nhúng chuỗi: DDL còn dùng cho psql và cho việc rà soát
  const ddl = await readFile(join(process.cwd(), 'lib', 'schema.sql'), 'utf8');
  for (const statement of splitStatements(ddl)) {
    await sql.query(statement);
  }
}

/**
 * Tách script thành từng câu lệnh.
 *
 * Không gửi cả script trong một gói: prepared statement chỉ nhận một câu, còn
 * server socket của PGlite thì đóng thẳng kết nối (ECONNRESET) khi nhận nhiều
 * câu. Chạy từng câu thì driver nào cũng chịu.
 *
 * Đủ dùng cho DDL của dự án (không có hàm, không có dollar-quote, không có dấu
 * chấm phẩy trong chuỗi). Nếu sau này cần những thứ đó thì phải đổi sang bộ
 * tách thật.
 */
function splitStatements(script: string): string[] {
  return script
    .replace(/--[^\r\n]*/g, '') // bỏ chú thích một dòng
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** timestamptz về từ driver là Date; phần còn lại của app dùng chuỗi ISO */
export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

export function isoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return iso(value);
}
