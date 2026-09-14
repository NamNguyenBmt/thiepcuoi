/**
 * Cho hai thiệp dùng chung một sổ lưu bút và một bộ đếm tim.
 *
 *   npm run gopluubut -- <slug gốc> <slug mượn>            # xem trước, không ghi
 *   npm run gopluubut -- <slug gốc> <slug mượn> --apply    # ghi thật
 *
 * Thiệp "mượn" dồn hết lời chúc đã có sang sổ của thiệp "gốc"; từ đó khách gửi
 * ở thiệp nào cũng vào chung một sổ, mở thiệp nào cũng thấy đủ. Số tim lấy của
 * thiệp gốc làm chuẩn — số riêng của thiệp mượn bị bỏ — rồi tim bấm ở thiệp nào
 * cũng cộng vào số chung. Phản hồi RSVP vẫn tách riêng theo thiệp.
 *
 * Đọc `DATABASE_URL` từ `apps/web/.env.prod.local` — cùng quy ước với
 * `them-luu-but.mts`. Cột `wishbook_invite_id` phải có sẵn, tức là bản code
 * mới đã deploy — chạy trước thì chính script sẽ migrate database hộ.
 */

import { loadEnvLocal } from './env.mts';

loadEnvLocal('.env.prod.local');

import { getHearts, getInviteBySlug, listWishes, shareWishbook } from '../lib/db';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const [slugGoc, slugMuon] = args.filter((a) => !a.startsWith('--'));

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? '';
if (!url || url.includes('localhost')) {
  die('DATABASE_URL trong apps/web/.env.prod.local chưa trỏ tới database thật.');
}
if (!slugGoc || !slugMuon) die('Cần hai slug: <slug gốc> <slug mượn>');

const goc = await getInviteBySlug(slugGoc);
const muon = await getInviteBySlug(slugMuon);
if (!goc) die(`Không có thiệp ${slugGoc}`);
if (!muon) die(`Không có thiệp ${slugMuon}`);
if (goc.ownerId !== muon.ownerId) die('Hai thiệp khác chủ — không gộp sổ của người khác.');

const truocGoc = await listWishes(goc.id);
const truocMuon = await listWishes(muon.id);
const daChung = truocMuon.length > 0 && truocMuon.every((w) => w.inviteId === goc.id);

console.log(`Gốc  ${slugGoc}: ${truocGoc.length} lời chúc, ${await getHearts(goc.id)} tim`);
console.log(
  `Mượn ${slugMuon}: ${daChung ? 'đã dùng chung sổ gốc' : `${truocMuon.length} lời chúc`}, ` +
    `${await getHearts(muon.id)} tim (đang đọc ra — có thể đã là số chung)`,
);
for (const w of truocMuon.filter((w) => w.inviteId === muon.id)) {
  console.log(`   · ${w.createdAt.slice(0, 16)}  ${w.name}: ${w.message.slice(0, 60)}`);
}

if (!apply) {
  console.log('\nMới là xem trước. Thêm --apply để ghi thật.');
  process.exit(0);
}

const kq = await shareWishbook(muon.id, goc.id);
if (!kq.ok) die(`✗ ${kq.error}`);

const sauGoc = await listWishes(goc.id);
const sauMuon = await listWishes(muon.id);
const timGoc = await getHearts(goc.id);
const khop =
  sauGoc.length === sauMuon.length &&
  sauGoc.every((w, i) => w.id === sauMuon[i]!.id) &&
  timGoc === (await getHearts(muon.id));
console.log(`\n✓ Đã dồn ${kq.moved} lời chúc, bỏ ${kq.droppedHearts} tim riêng của thiệp mượn.`);
console.log(`  Sổ chung: ${sauGoc.length} lời chúc, ${timGoc} tim.`);
console.log(khop ? '✓ Hai thiệp đọc ra cùng một sổ, cùng số tim.' : '✗ Đọc lại hai thiệp ra khác nhau — xem lại!');
process.exit(khop ? 0 : 1);
