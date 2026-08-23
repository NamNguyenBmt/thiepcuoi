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
import { createHash } from 'node:crypto';
import type { TemplateDoc } from '@thiepcuoi/schema';
import { assertConfig } from './config-check';
import { once } from './once';
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

const ready = once(connect);

export function getSql(): Promise<Sql> {
  return ready.get();
}

/** Chỉ dùng trong test: quên kết nối cũ để lần sau đọc lại biến môi trường */
export function resetSql(): void {
  ready.reset();
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
  await syncBuiltinTemplates(sql);
  return sql;
}

/**
 * Đồng bộ mẫu dựng sẵn vào một database đã có dữ liệu: chèn mẫu còn thiếu, và
 * cập nhật mẫu mà KHÔNG AI TỪNG SỬA.
 *
 * `seedIfEmpty` chỉ chạy khi bảng `users` còn trống — đúng cho lần dựng đầu,
 * nhưng nghĩa là mọi thay đổi mẫu về sau không bao giờ tới được production đang
 * chạy. Chỗ đó phải lấp bằng tay: cầm `DATABASE_URL` của production chạy
 * `npm run seed:templates -- --force`. Mỗi lần sửa mẫu lại một lần như vậy, và
 * quên thì deploy xong giao diện vẫn y nguyên. Bước này biến nó thành: đẩy code
 * là xong.
 *
 * Ranh giới an toàn là cột `builtin_hash` — dấu vân của bản mà chính app đã ghi
 * xuống lần trước:
 *
 *   hash(doc_packed) === builtin_hash  → hàng còn nguyên như app để lại, ghi đè
 *   lệch nhau                          → có người sửa trong editor, KHÔNG đụng
 *
 * So bằng nội dung chứ không bằng `revision`: `revision` còn tăng vì những lý
 * do khác, và một mẫu bị sửa rồi sửa ngược về như cũ thì ghi đè cũng vô hại.
 * Điều phải tránh là nuốt mất công người ta đã bỏ ra trong editor — mà cái đó
 * chỉ nhìn thấy được ở nội dung.
 *
 * `builtin_hash` null là hàng có trước khi cột này tồn tại. Nhận lại nó khi
 * `revision = 1` — chưa từng qua một lần Lưu nào, tức đúng là bản app đặt xuống
 * và không ai đụng. Còn `revision > 1` thì để yên: mẫu "Ngọt ngào" trên
 * production đang ở bản 12 vì chủ thiệp sửa trong editor, và nhận nhầm nó là
 * xoá sạch công của họ ngay lần khởi động kế tiếp.
 *
 * Giá phải trả trên cold start là đúng một câu `select`; ảnh mồi chỉ dựng lại
 * khi thật sự có việc phải ghi.
 */
async function syncBuiltinTemplates(sql: Sql): Promise<void> {
  const { builtinTemplates } = await import('./seed');
  const { packDoc } = await import('@thiepcuoi/schema');
  const docs = builtinTemplates().map((doc) => {
    const packed = packDoc(doc);
    return { doc, packed, hash: fingerprint(packed) };
  });

  const { rows: have } = await sql.query<{
    slug: string; doc_packed: string; builtin_hash: string | null; revision: number;
  }>(
    'select slug, doc_packed, builtin_hash, revision from templates where slug = any($1)',
    [docs.map((d) => d.doc.slug)],
  );
  const bySlug = new Map(have.map((r) => [r.slug, r]));

  const missing = docs.filter((d) => !bySlug.has(d.doc.slug));

  /**
   * Mỗi hàng ghi đè mang theo `guard` — chính điều kiện vừa dùng để phân loại,
   * lặp lại trong mệnh đề `where` của câu update. Giữa lúc đọc và lúc ghi, một
   * người có thể vừa bấm Lưu trong editor; bản của họ phải thắng.
   */
  const writes: Array<{ doc: TemplateDoc; packed: string; hash: string; guard: string; changed: boolean }> = [];
  for (const d of docs) {
    const row = bySlug.get(d.doc.slug);
    if (!row) continue;

    const ours = row.builtin_hash !== null && row.builtin_hash === fingerprint(row.doc_packed);
    const adoptable = row.builtin_hash === null && row.revision === 1;
    if (!ours && !adoptable) continue;

    const changed = row.doc_packed !== d.packed;
    if (!changed && !adoptable) continue;
    writes.push({
      ...d,
      guard: ours ? `builtin_hash = '${row.builtin_hash}'` : 'builtin_hash is null and revision = 1',
      changed,
    });
  }
  if (missing.length === 0 && writes.length === 0) return;

  /**
   * Ảnh mồi phải thuộc về một người có thật (`assets.owner_id` tham chiếu
   * `users` kèm `on delete cascade`). Không có ai thì database này chưa dựng
   * xong — để lần khởi động sau lo, đừng nửa vời.
   */
  const { rows: owners } = await sql.query<{ id: string }>(
    `select id from users order by (role = 'admin') desc, created_at asc limit 1`,
  );
  const ownerId = owners[0]?.id;
  if (!ownerId) return;

  const { buildSeedAssets } = await import('./seed-assets');

  // Mẫu mới có thể trỏ tới hoạ tiết mà database này chưa từng thấy. Ghi đè lên
  // chính nó là vô hại: khoá là uuid cố định và nội dung tất định.
  const assets = await buildSeedAssets(ownerId);
  const now = new Date().toISOString();

  await sql.transaction(async (tx) => {
    for (const a of assets) {
      await tx.query(
        `insert into assets (id, key, owner_id, mime, width, height, bytes, original_name, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do nothing`,
        [a.row.id, a.row.key, ownerId, a.row.mime, a.row.width, a.row.height, a.row.bytes,
         a.row.originalName, now],
      );
    }
    for (const { doc, packed, hash } of missing) {
      // `on conflict do nothing` không nêu tên ràng buộc, để bắt cả `slug` lẫn
      // `id`: nhiều instance cùng khởi động thì cả hai đều thấy thiếu một mẫu.
      await tx.query(
        `insert into templates (id, slug, name, owner_id, doc_packed, thumbnail, usage_count, builtin_hash)
         values ($1, $2, $3, $4, $5, null, 0, $6)
         on conflict do nothing`,
        [doc.id, doc.slug, doc.name, ownerId, packed, hash],
      );
    }
    for (const { doc, packed, hash, guard, changed } of writes) {
      // Nội dung không đổi thì chỉ đóng dấu vân, KHÔNG tăng `revision`: tăng
      // vô cớ sẽ làm mọi editor đang mở báo xung đột dù chẳng có gì khác.
      //
      // Mỗi nhánh mang đúng số tham số nó dùng: Postgres suy kiểu tham số từ
      // chỗ chúng xuất hiện trong câu lệnh, nên một $n thừa ra là lỗi 42P18
      // ngay lúc phân tích, không phải lúc chạy.
      await tx.query(
        changed
          ? `update templates set name = $2, doc_packed = $3, builtin_hash = $4,
                    revision = revision + 1
               where slug = $1 and ${guard}`
          : `update templates set builtin_hash = $2 where slug = $1 and ${guard}`,
        changed ? [doc.slug, doc.name, packed, hash] : [doc.slug, hash],
      );
    }
  });

  const names = (list: Array<{ doc: TemplateDoc }>) => list.map((d) => d.doc.slug).join(', ');
  const parts = [
    missing.length > 0 ? `đã thêm ${names(missing)}` : '',
    writes.some((w) => w.changed) ? `đã cập nhật ${names(writes.filter((w) => w.changed))}` : '',
    writes.some((w) => !w.changed) ? `đã nhận dấu vân ${names(writes.filter((w) => !w.changed))}` : '',
  ].filter(Boolean);
  console.warn(`[templates] ${parts.join('; ')}`);
}

/** Dấu vân nội dung mẫu — chỉ để phát hiện thay đổi, không phải để bảo mật */
function fingerprint(packed: string): string {
  return createHash('sha256').update(packed).digest('hex').slice(0, 32);
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

/**
 * Áp dụng schema, và **bỏ qua khi database đã đúng phiên bản đó rồi**.
 *
 * Trước đây chạy lại cả 14 câu DDL mỗi lần khởi động. Mỗi câu là một round trip,
 * nên khi hàm còn chạy khác châu lục với database thì riêng bước này đã ngốn
 * ~2,5 giây của mọi cold start — người mở thiệp đầu tiên sau một lúc vắng khách
 * phải trả cái giá đó.
 *
 * So sánh nguyên văn nội dung `schema.sql`: sửa file (kể cả thêm bảng mới) là
 * khác chuỗi, khác chuỗi thì chạy lại từ đầu — mọi câu đều `if not exists` nên
 * chạy lại không hỏng gì. Chỉ ghi nhận sau khi toàn bộ DDL chạy xong, nên nửa
 * chừng gãy thì lần khởi động sau vẫn thử lại.
 *
 * Export để test đếm được số câu lệnh thật sự gửi đi.
 */
export async function migrate(sql: Sql): Promise<void> {
  // Đọc từ file thay vì nhúng chuỗi: DDL còn dùng cho psql và cho việc rà soát
  const ddl = await readFile(join(process.cwd(), 'lib', 'schema.sql'), 'utf8');

  if ((await appliedDdl(sql)) === ddl) return;

  for (const statement of splitStatements(ddl)) {
    await sql.query(statement);
  }

  await sql.query(
    `insert into schema_state (id, ddl, applied_at) values (1, $1, now())
     on conflict (id) do update set ddl = excluded.ddl, applied_at = now()`,
    [ddl],
  );
}

/**
 * Schema đang áp dụng, hoặc null nếu database còn trắng.
 *
 * Hỏi thẳng rồi bắt lỗi thay vì kiểm `to_regclass` trước: đường thường gặp
 * (database đã dựng xong) chỉ tốn đúng một round trip, còn nhánh lỗi chỉ xảy ra
 * đúng lần đầu đời của một database.
 */
async function appliedDdl(sql: Sql): Promise<string | null> {
  try {
    const { rows } = await sql.query<{ ddl: string }>('select ddl from schema_state where id = 1');
    return rows[0]?.ddl ?? null;
  } catch {
    // Chưa có bảng schema_state — coi như chưa migrate lần nào
    return null;
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
