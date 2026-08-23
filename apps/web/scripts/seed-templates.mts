/**
 * Nạp mẫu dựng sẵn + ảnh mồi vào một database ĐÃ CÓ dữ liệu.
 *
 *   npm run seed:templates                            # chỉ thêm mẫu còn thiếu
 *   npm run seed:templates -- --force                 # ghi đè mọi mẫu dựng sẵn
 *   npm run seed:templates -- --force ngot-ngao       # ghi đè đúng mẫu nêu tên
 *
 * Vì sao cần: `seedIfEmpty` trong `lib/sql.ts` chỉ chạy khi bảng `users` còn
 * trống — đúng cho lần dựng đầu, nhưng nghĩa là mọi mẫu thêm về sau không bao
 * giờ tới được database đang chạy. Script này lấp đúng khoảng đó.
 *
 * Ba thứ nó KHÔNG đụng tới: `users`, `invites`, và mẫu do người dùng tự dựng.
 * Mặc định mẫu trùng slug cũng để nguyên — chủ thiệp có thể đã sửa "Cơ bản"
 * trong editor, ghi đè lên là mất công của họ. `--force` mới ghi đè, và khi đó
 * `revision` tăng nên editor đang mở sẽ báo xung đột thay vì lặng lẽ nuốt mất.
 */

import { loadEnvLocal } from './env.mts';

loadEnvLocal();

import { packDoc } from '@thiepcuoi/schema';
import { getSql } from '../lib/sql';
import { buildSeedAssets } from '../lib/seed-assets';
import { demoTemplate } from '../lib/seed';
import { fullTemplate } from '../lib/seed-template';
import { sweetTemplate } from '../lib/seed-template-42';

const force = process.argv.includes('--force');
/**
 * Tham số không phải cờ = danh sách slug được phép đụng tới. Không nêu tên thì
 * áp cho tất cả. Có bộ lọc này vì `--force` trần sẽ cuốn theo cả mẫu mà chủ
 * thiệp đã sửa trong editor — chỉ muốn cập nhật một mẫu mà mất bài của họ ở
 * mẫu khác là cái giá không đáng.
 */
const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));
const wanted = (slug: string) => only.size === 0 || only.has(slug);
const sql = await getSql();

/**
 * Ảnh mồi phải thuộc về một người có thật: `assets.owner_id` tham chiếu `users`
 * kèm `on delete cascade`. Chọn admin trước — xoá một tài khoản thường mà kéo
 * theo cả ảnh của mẫu thì mọi thiệp dùng mẫu đó vỡ hình cùng lúc.
 */
const { rows: owners } = await sql.query<{ id: string; email: string; role: string }>(
  `select id, email, role from users order by (role = 'admin') desc, created_at asc limit 1`,
);
const owner = owners[0];
if (!owner) {
  console.error('Database chưa có người dùng nào — chạy app một lần để seed lần đầu đã.');
  process.exit(1);
}
console.log(`Chủ sở hữu ảnh mồi: ${owner.email} (${owner.role})`);

// ── Ảnh mồi ──────────────────────────────────────────────────────────────
//
// `buildSeedAssets` ghi thẳng vào kho blob (đĩa hoặc S3/R2) rồi trả về hàng để
// chèn. Ghi đè lên chính nó là vô hại vì khoá là uuid cố định và nội dung tất
// định; còn hàng trong bảng thì `on conflict do nothing` để không đụng ảnh cũ.

const assets = await buildSeedAssets(owner.id);
let added = 0;
for (const a of assets) {
  // `returning id` chứ không đọc rowCount: interface `Sql` cố tình chỉ phơi ra
  // `rows`, nên rowCount luôn undefined và bộ đếm sẽ lặng lẽ báo 0.
  const { rows } = await sql.query<{ id: string }>(
    `insert into assets (id, key, owner_id, mime, width, height, bytes, original_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do nothing
     returning id`,
    [a.row.id, a.row.key, owner.id, a.row.mime, a.row.width, a.row.height, a.row.bytes, a.row.originalName],
  );
  if (rows.length > 0) added += 1;
}
console.log(`Ảnh mồi: ${assets.length} tấm đã ghi vào kho, ${added} hàng mới trong bảng assets`);

// ── Mẫu ──────────────────────────────────────────────────────────────────

for (const doc of [demoTemplate(), fullTemplate(), sweetTemplate()]) {
  if (!wanted(doc.slug)) {
    console.log(`  · bỏ qua "${doc.name}" (${doc.slug}) — không nằm trong danh sách chỉ định`);
    continue;
  }
  const packed = packDoc(doc);
  const { rows } = await sql.query<{ id: string }>('select id from templates where slug = $1', [doc.slug]);
  const existing = rows[0];

  if (!existing) {
    await sql.query(
      `insert into templates (id, slug, name, owner_id, doc_packed, thumbnail, usage_count)
       values ($1, $2, $3, $4, $5, null, 0)`,
      [doc.id, doc.slug, doc.name, owner.id, packed],
    );
    console.log(`  + thêm "${doc.name}" (/mau/${doc.slug})`);
  } else if (force) {
    await sql.query(
      'update templates set name = $2, doc_packed = $3, revision = revision + 1 where id = $1',
      [existing.id, doc.name, packed],
    );
    console.log(`  ~ ghi đè "${doc.name}" (/mau/${doc.slug})`);
  } else {
    console.log(`  = bỏ qua "${doc.name}" (/mau/${doc.slug}) — đã có, dùng --force nếu muốn ghi đè`);
  }
}

process.exit(0);
