/**
 * Chạy PGlite như một server Postgres thật trên cổng 5432.
 *
 * Vì sao phải tách tiến trình: nếu nhúng PGlite thẳng vào Next dev thì bộ nhớ
 * WASM nằm chung tiến trình với renderer, và mọi trang có truyền dữ liệu xuống
 * client component đều trả 500 —
 *   TypeError: ArrayBuffer is not detachable and could not be cloned
 * Tách ra, app chỉ nói chuyện qua socket bằng đúng driver `pg` của production.
 *
 *   npm run db:dev     # cửa sổ riêng
 *   DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run dev
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dataDir = process.env.PGLITE_DIR ?? '.data/pg';
const port = Number(process.env.PGLITE_PORT ?? 5432);

const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });

await server.start();
console.log(`PGlite đang lắng nghe tại postgres://postgres@localhost:${port}/postgres (dữ liệu: ${dataDir})`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
