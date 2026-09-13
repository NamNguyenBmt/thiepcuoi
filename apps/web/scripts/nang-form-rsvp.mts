/**
 * Nới chiều cao khung "Xác nhận tham dự" cho vừa nội dung.
 *
 *   npm run naform                       # xem mẫu nào đang thiếu chỗ
 *   npm run naform -- --apply            # ghi thật
 *   npm run naform -- <slug> --apply     # chỉ mẫu nêu tên
 *
 * Vì sao: mẫu "Ngọt ngào" đặt khung form cao 366 trong khi nội dung của nó —
 * tiêu đề, ô tên, hai lựa chọn tham dự, ô số người, nút gửi — chiếm 389px kể cả
 * padding. Phần thừa bị mép dưới cắt, và thứ rơi đúng vào chỗ bị cắt là NÚT
 * GỬI: khách thấy một nút bị xẻ đôi, không biết là cuộn trong khung thì thấy
 * tiếp. Runtime đã ghim nút dính đáy nên nút không còn bị cắt nữa, nhưng khung
 * vẫn hiện thanh cuộn — nới cho vừa thì mới hết hẳn.
 *
 * Chỉ đổi đúng một con số `height` của node RsvpForm, không dời gì khác, và chỉ
 * khi phía dưới còn đủ chỗ trống. Mẫu do người dùng sửa trong editor cũng chạy
 * được — đây là lý do script này tồn tại thay vì nạp lại mẫu từ mã nguồn.
 *
 * Đọc `DATABASE_URL` từ `apps/web/.env.prod.local`, cùng quy ước với
 * `gan-nhac.mts`, `split-invite.mts` và `them-luu-but.mts`.
 */

import { loadEnvLocal } from './env.mts';

loadEnvLocal('.env.prod.local');

import { packDoc, unpackDoc } from '@thiepcuoi/schema';
import { getSql } from '../lib/sql';
import { getTemplateById, listTemplates, updateTemplate } from '../lib/db';

/** Chiều cao tối thiểu, đo bằng trình duyệt trên chính mẫu "Ngọt ngào" */
const CAO_TOI_THIEU = 400;
/** Chừa lại chừng này dưới đáy form, để nó không dính sát node kế tiếp */
const CHUA_LAI = 24;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slugs = args.filter((a) => !a.startsWith('--'));

const url = process.env.DATABASE_URL ?? '';
if (!url || url.includes('localhost')) {
  console.error('DATABASE_URL trong apps/web/.env.prod.local chưa trỏ tới database thật.');
  process.exit(1);
}

const sql = await getSql();
const tatCa = await listTemplates();
const chon = slugs.length > 0 ? tatCa.filter((t) => slugs.includes(t.slug)) : tatCa;

let daGhi = 0;
for (const t of chon) {
  const doc = unpackDoc(t.docPacked);
  const form = Object.values(doc.nodes).find((n) => n.type === 'RsvpForm');
  if (!form) continue;

  const cao = form.props.height;
  if (cao >= CAO_TOI_THIEU) {
    console.log(`·  ${t.slug} — đã cao ${cao}, không cần nới`);
    continue;
  }

  // Chỗ trống = khoảng cách tới node gần nhất bắt đầu dưới đáy form
  const day = form.props.top + cao;
  const ke = Object.values(doc.nodes)
    .filter((n) => n.id !== form.id && n.props.top >= day)
    .sort((a, b) => a.props.top - b.props.top)[0];
  const trong = ke ? ke.props.top - day : Infinity;
  const noiThem = CAO_TOI_THIEU - cao;

  if (trong < noiThem + CHUA_LAI) {
    console.log(
      `⚠  ${t.slug} — cần thêm ${noiThem}px nhưng dưới chỉ còn ${Math.round(trong)}px ` +
        `(${ke?.name} @${Math.round(ke!.props.top)}) — bỏ qua, phải dời bằng tay`,
    );
    continue;
  }

  console.log(`${apply ? '~' : '?'}  ${t.slug}: khung form ${cao} → ${CAO_TOI_THIEU} (dưới còn ${Math.round(trong)}px)`);
  if (!apply) continue;

  const { rows } = await sql.query<{ revision: number }>('select revision from templates where id = $1', [t.id]);
  if (rows[0]?.revision !== t.revision) {
    console.log(`   ⚠ vừa có người lưu (rev ${t.revision} → ${rows[0]?.revision}) — bỏ qua, chạy lại sau.`);
    continue;
  }

  form.props.height = CAO_TOI_THIEU;
  await updateTemplate(t.id, { docPacked: packDoc(doc) });

  const lai = await getTemplateById(t.id);
  const kiem = lai ? Object.values(unpackDoc(lai.docPacked).nodes).find((n) => n.type === 'RsvpForm') : null;
  const ok = kiem?.props.height === CAO_TOI_THIEU;
  console.log(`   ${ok ? '✓ đã ghi' : '✗ đọc lại vẫn thấy số cũ'} (rev ${lai?.revision})`);
  if (ok) daGhi += 1;
}

console.log(apply ? `\nXong: ${daGhi} mẫu đã nới khung.` : '\nMới là xem trước. Thêm --apply để ghi thật.');
process.exit(0);
