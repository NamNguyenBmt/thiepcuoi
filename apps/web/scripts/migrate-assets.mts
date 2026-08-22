/**
 * Chuyển ảnh đã có trên đĩa lên kho S3/R2 đang cấu hình.
 *
 *   npm run assets:migrate -- --dry-run
 *   npm run assets:migrate
 *
 * Vì sao cần: đổi `S3_*` là app lập tức đọc/ghi ở kho mới, nhưng file cũ vẫn
 * nằm im trên đĩa. Thiệp nào đang trỏ tới ảnh cũ sẽ vỡ ảnh — đây là bước phải
 * chạy TRƯỚC khi đổi cấu hình, hoặc ngay sau đó.
 *
 * Script chỉ ghi thêm, không xoá file nguồn: chạy lại nhiều lần cũng không sao,
 * và nếu cần lùi lại thì bản gốc vẫn còn.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnvLocal } from './env.mts';

loadEnvLocal();

import { Client } from 'pg';
import { getBlobStore } from '../lib/blobstore';
import { isValidKey } from '../lib/storage';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), '.data', 'uploads');
const dryRun = process.argv.includes('--dry-run');

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

if (!process.env.S3_BUCKET) {
  console.error('Chưa cấu hình S3_BUCKET — không có gì để chuyển tới.');
  process.exit(1);
}

const store = await getBlobStore();

// Lấy danh sách từ DB chứ không quét thư mục: chỉ những ảnh thật sự được ghi
// nhận mới cần chuyển, file rác trong thư mục thì kệ nó.
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const rows = (await db.query<{ key: string }>('select key from assets order by created_at')).rows;
await db.end();

let daCo = 0;
let daChuyen = 0;
const loi: Array<{ key: string; ly_do: string }> = [];

for (const { key } of rows) {
  if (!isValidKey(key)) {
    loi.push({ key, ly_do: 'key không hợp lệ' });
    continue;
  }

  // Đã có ở kho đích thì bỏ qua — cho phép chạy lại script mà không tốn băng thông
  try {
    await store.get(key);
    daCo++;
    continue;
  } catch {
    /* chưa có, chuyển tiếp */
  }

  let data: Buffer;
  try {
    data = await readFile(join(UPLOAD_DIR, key.slice('uploads/'.length)));
  } catch {
    loi.push({ key, ly_do: 'không thấy file trên đĩa' });
    continue;
  }

  const ext = key.split('.').pop() ?? '';
  if (dryRun) {
    console.log(`   [thử] sẽ chuyển ${key} (${data.length}B)`);
  } else {
    await store.put(key, data, MIME[ext] ?? 'application/octet-stream');
    console.log(`   đã chuyển ${key} (${data.length}B)`);
  }
  daChuyen++;
}

console.log(
  `\n${dryRun ? '[thử] ' : ''}Tổng ${rows.length} ảnh: ${daCo} đã có sẵn, ${daChuyen} ${dryRun ? 'cần chuyển' : 'đã chuyển'}, ${loi.length} lỗi`,
);
for (const l of loi) console.log(`   LỖI ${l.key}: ${l.ly_do}`);

process.exit(loi.length > 0 ? 1 : 0);
