/**
 * Gắn nhạc nền cho một thiệp, bằng cách NHÂN BẢN mẫu chứ không sửa mẫu chung.
 *
 *   npm run nhac -- <slug>                        # xem trước, KHÔNG ghi gì
 *   npm run nhac -- <slug> --apply                # làm thật
 *   npm run nhac -- <slug> --apply --mp3 <đường-dẫn>
 *
 * Đọc `DATABASE_URL` từ `apps/web/.env.prod.local` — cùng quy ước với
 * `split-invite.mts`, và vì đúng lý do đó: hai file cạnh nhau mà một cái trỏ
 * vào máy bạn, một cái trỏ vào production, nhầm chỗ là ghi dữ liệu thật vào
 * Postgres cục bộ hoặc tệ hơn là ngược lại. Cần cả biến `S3_*` của production,
 * vì file mp3 phải nằm đúng kho mà web đang phục vụ.
 *
 * Phần quyết định nằm ở `lib/attach-audio.ts`; ở đây chỉ là vỏ dòng lệnh.
 */

import { loadEnvLocal } from './env.mts';

// Chỉ nạp file production, và không cho `.env.local` chen vào.
loadEnvLocal('.env.prod.local');

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { unpackDoc } from '@thiepcuoi/schema';
import { getSql, describeDatabaseUrl } from '../lib/sql';
import { getInviteBySlug, getTemplateById } from '../lib/db';
import { attachAudio, cloneName, isAttachError, isSharedTemplate } from '../lib/attach-audio';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slug = args.find((a) => !a.startsWith('--'));
const mp3Flag = args.indexOf('--mp3');
const mp3Path = mp3Flag >= 0 && args[mp3Flag + 1]
  ? args[mp3Flag + 1]!
  : join(process.cwd(), '..', '..', '.local', 'nhac-thiep-cuoi.mp3');

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (!slug) die('Thiếu slug thiệp. Ví dụ: npm run nhac -- nam-thuy-2');

const url = process.env.DATABASE_URL;
if (!url || url.includes('<')) {
  die('Chưa có DATABASE_URL trong apps/web/.env.prod.local — dán chuỗi kết nối vào đó đã.');
}
if (!process.env.S3_BUCKET) {
  die('Chưa có S3_* trong apps/web/.env.prod.local — không biết đẩy mp3 vào kho nào.');
}

let nhac: Buffer;
try {
  nhac = readFileSync(mp3Path);
} catch {
  die(`Không đọc được file nhạc: ${mp3Path}`);
}

console.log(`Database: ${describeDatabaseUrl()}`);
console.log(`Kho:      ${process.env.S3_BUCKET}`);
console.log(`Nhạc:     ${mp3Path} (${(nhac.length / 1024).toFixed(0)} KB)`);
console.log(apply ? 'Chế độ: GHI THẬT (--apply)\n' : 'Chế độ: xem trước, không ghi gì\n');

await getSql();

// Xem trước thì đọc y hệt những gì `attachAudio` sẽ đọc, rồi dừng trước khi ghi
if (!apply) {
  const invite = await getInviteBySlug(slug!);
  if (!invite) die(`Không có thiệp nào mang slug "${slug}".`);
  const source = await getTemplateById(invite.templateId);
  if (!source) die(`Thiệp trỏ tới mẫu ${invite.templateId} mà mẫu đó không còn.`);

  const shared = await isSharedTemplate(source, invite.ownerId);
  console.log(`Thiệp:    ${invite.slug} (${invite.id})`);
  console.log(`Mẫu:      ${source.name} — ${source.slug} (${source.id})`);
  console.log(`Nhạc mẫu: ${unpackDoc(source.docPacked).audio?.key ?? '(chưa có)'}`);
  console.log(shared
    ? `\nMẫu dùng chung → sẽ nhân bản thành "${cloneName(source.name, invite.slug)}", mẫu gốc giữ nguyên.`
    : '\nMẫu đã là bản riêng của chủ thiệp → sẽ sửa thẳng, không nhân bản.');
  console.log('\nChạy lại kèm --apply để làm thật.');
  process.exit(0);
}

const ket = await attachAudio({
  inviteSlug: slug!,
  bytes: new Uint8Array(nhac),
  fileName: basename(mp3Path),
});
if (isAttachError(ket)) die(ket.error);

if (ket.cloned) {
  console.log(`Đã nhân bản mẫu: ${ket.template.name} — ${ket.template.slug} (${ket.template.id})`);
  console.log(`Mẫu chung "${ket.sourceTemplate.slug}" giữ nguyên.`);
} else {
  console.log(`Sửa thẳng mẫu riêng: ${ket.template.slug}`);
}
console.log(`Đã tải nhạc lên: ${ket.asset.key} (${(ket.asset.bytes / 1024).toFixed(0)} KB)`);
console.log('Đã đặt doc.audio: lặp lại, không tự phát.');
if (ket.cloned) console.log(`Đã trỏ thiệp "${ket.invite.slug}" sang mẫu mới.`);

console.log('\nXong. Mở lại trang thiệp và chạm mở bì thư để nghe.');
process.exit(0);
