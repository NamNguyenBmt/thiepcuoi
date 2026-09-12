/**
 * Chèn phần "Sổ lưu bút" vào những mẫu họ "Ngọt ngào" chưa có.
 *
 *   npm run luubut                          # liệt kê mẫu nào có, mẫu nào chưa
 *   npm run luubut -- <slug mẫu> …          # xem trước, không ghi
 *   npm run luubut -- <slug mẫu> --apply    # ghi thật
 *   npm run luubut -- --tat-ca --apply      # mọi mẫu còn thiếu
 *
 * Vì sao cần script này thay vì `seed:templates -- --force`:
 *
 * Bước đồng bộ lúc khởi động (`syncBuiltinTemplates`) đã tự đặt phần lưu bút
 * vào những mẫu dựng sẵn còn nguyên vẹn. Nó CỐ TÌNH bỏ qua mẫu đã có người sửa
 * trong editor — và `--force` thì ghi đè thẳng, nuốt mất công của họ. Hai mẫu
 * cần chèn ở đây đều thuộc loại đó: mẫu "Ngọt ngào" chung (chủ thiệp đã chỉnh)
 * và những bản sao riêng mà script gắn nhạc tạo ra cho từng thiệp — bản sao là
 * ảnh chụp đông cứng, không bao giờ nhận được thay đổi từ mã nguồn nữa.
 *
 * Cách chèn là dời chỗ chứ không vẽ đè: mở ra một dải trống 600px ngay trước
 * phần "Mừng cưới", đẩy mọi thứ từ đó xuống, rồi đặt khối lưu bút vào dải đó.
 * Không node nào của mẫu vắt ngang chỗ cắt (script kiểm và dừng nếu có), nên
 * phần còn lại của thiệp giữ nguyên từng pixel.
 *
 * Đọc `DATABASE_URL` từ `apps/web/.env.prod.local` — cùng quy ước với
 * `gan-nhac.mts` và `split-invite.mts`.
 */

import { loadEnvLocal } from './env.mts';

loadEnvLocal('.env.prod.local');

import { packDoc, unpackDoc } from '@thiepcuoi/schema';
import type { TemplateDoc, TemplateNode } from '@thiepcuoi/schema';
import { getSql } from '../lib/sql';
import { getTemplateById, listTemplates, updateTemplate } from '../lib/db';
import { sweetTemplate } from '../lib/seed-template-42';

/** Cao độ dải chèn thêm — phải khớp `WISHES_HEIGHT` của mẫu gốc */
const H = 600;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const tatCa = args.includes('--tat-ca');
const slugs = args.filter((a) => !a.startsWith('--'));

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? '';
if (!url || url.includes('localhost')) {
  die('DATABASE_URL trong apps/web/.env.prod.local chưa trỏ tới database thật.');
}

/** Khối lưu bút lấy thẳng từ mẫu gốc, để chỉ có một nguồn sự thật về bố cục */
function khoiLuuBut(): { nodes: TemplateNode[]; offset: (n: TemplateNode) => number } {
  const mau = sweetTemplate('full');
  const sec = mau.sections.find((s) => s.id === 'sec-wishes');
  if (!sec) die('Mẫu gốc không còn section sec-wishes — script này hết hạn dùng.');
  const nodes = mau.order
    .map((id) => mau.nodes[id]!)
    .filter((n) => n.sectionId === 'sec-wishes');
  return { nodes, offset: (n) => n.props.top - sec.top };
}

type KetQua =
  | { ok: false; ly_do: string }
  | { ok: true; doc: TemplateDoc; cut: number; them: number };

function chen(doc: TemplateDoc): KetQua {
  if (Object.values(doc.nodes).some((n) => n.type === 'Wishes')) {
    return { ok: false, ly_do: 'đã có sổ lưu bút' };
  }
  const gift = doc.sections.find((s) => s.id === 'sec-gift');
  if (!gift) return { ok: false, ly_do: 'không có section sec-gift để chèn vào trước' };
  if (doc.sections.some((s) => s.id === 'sec-wishes')) {
    return { ok: false, ly_do: 'đã có section sec-wishes (nhưng không có node) — xem lại bằng tay' };
  }

  const cut = gift.top;

  // Node vắt ngang chỗ cắt sẽ bị dải trống xẻ đôi. Mẫu này cố ý cho ảnh tràn
  // qua ranh giới section ở vài chỗ, nên phải kiểm chứ không đoán.
  const vatNgang = Object.values(doc.nodes).filter(
    (n) => n.props.top < cut && n.props.top + n.props.height > cut + 1,
  );
  if (vatNgang.length > 0) {
    return {
      ok: false,
      ly_do: `có ${vatNgang.length} node vắt ngang mốc ${cut} (${vatNgang
        .map((n) => `${n.name}@${Math.round(n.props.top)}`)
        .join(', ')}) — chèn vào sẽ xẻ đôi chúng`,
    };
  }

  const doiXuong = new Set(doc.sections.filter((s) => s.top >= cut).map((s) => s.id));
  for (const s of doc.sections) if (doiXuong.has(s.id)) s.top += H;
  for (const n of Object.values(doc.nodes)) if (doiXuong.has(n.sectionId)) n.props.top += H;
  doc.canvas.height += H;

  doc.sections.splice(doc.sections.findIndex((s) => s.id === 'sec-gift'), 0, {
    id: 'sec-wishes',
    name: 'Sổ lưu bút',
    top: cut,
    height: H,
    // Mẫu này để nền cho canvas lo, section trong suốt — giữ đúng quy ước đó.
    background: null,
  });

  const { nodes, offset } = khoiLuuBut();
  nodes.forEach((mau, i) => {
    const node = structuredClone(mau) as TemplateNode;
    node.id = `${doc.id}-luubut-${i}`;
    node.props.top = cut + offset(mau);
    doc.nodes[node.id] = node;
    doc.order.push(node.id);
  });

  return { ok: true, doc, cut, them: nodes.length };
}

const sql = await getSql();
const tatCaMau = await listTemplates();
const hoNgotNgao = tatCaMau.filter((t) => t.slug.startsWith('ngot-ngao'));

if (slugs.length === 0 && !tatCa) {
  console.log('Mẫu họ "Ngọt ngào" trên production:\n');
  for (const t of hoNgotNgao) {
    const doc = unpackDoc(t.docPacked);
    const co = Object.values(doc.nodes).some((n) => n.type === 'Wishes');
    console.log(`  ${co ? '✓' : '·'} ${t.slug.padEnd(40)} ${co ? 'đã có sổ lưu bút' : 'CHƯA CÓ'}  (rev ${t.revision})`);
  }
  const thieu = hoNgotNgao.filter((t) => !Object.values(unpackDoc(t.docPacked).nodes).some((n) => n.type === 'Wishes'));
  console.log(
    thieu.length === 0
      ? '\nKhông còn mẫu nào thiếu.'
      : `\nChèn hết: npm run luubut -- --tat-ca --apply`,
  );
  process.exit(0);
}

const chon = tatCa ? hoNgotNgao : hoNgotNgao.filter((t) => slugs.includes(t.slug));
const khongThay = slugs.filter((s) => !chon.some((t) => t.slug === s));
if (khongThay.length > 0) die(`Không có mẫu nào tên: ${khongThay.join(', ')}`);

let daGhi = 0;
for (const t of chon) {
  const doc = unpackDoc(t.docPacked);
  const truoc = { sections: doc.sections.length, canvas: doc.canvas.height };
  const kq = chen(doc);

  if (!kq.ok) {
    console.log(`·  ${t.slug} — bỏ qua: ${kq.ly_do}`);
    continue;
  }

  console.log(
    `${apply ? '~' : '?'}  ${t.slug}: chèn ${kq.them} node tại ${kq.cut}, ` +
      `section ${truoc.sections} → ${doc.sections.length}, canvas ${truoc.canvas} → ${doc.canvas.height}`,
  );

  if (!apply) continue;

  /*
   * Ghi có chốt `revision`: giữa lúc đọc và lúc ghi, chủ thiệp có thể vừa bấm
   * Lưu trong editor. Bản của họ phải thắng, thà chạy lại script còn hơn nuốt
   * mất một lần lưu.
   */
  const { rows } = await sql.query<{ revision: number }>(
    'select revision from templates where id = $1',
    [t.id],
  );
  if (rows[0]?.revision !== t.revision) {
    console.log(`   ⚠ ${t.slug} vừa có người lưu (rev ${t.revision} → ${rows[0]?.revision}) — bỏ qua, chạy lại sau.`);
    continue;
  }

  await updateTemplate(t.id, { docPacked: packDoc(doc) });
  const lai = await getTemplateById(t.id);
  const kiem = lai ? unpackDoc(lai.docPacked) : null;
  const co = kiem ? Object.values(kiem.nodes).some((n) => n.type === 'Wishes') : false;
  console.log(`   ${co ? '✓ đã ghi' : '✗ ghi xong mà đọc lại không thấy node'} (rev ${lai?.revision})`);
  if (co) daGhi += 1;
}

console.log(
  apply
    ? `\nXong: ${daGhi} mẫu đã có thêm sổ lưu bút.`
    : '\nMới là xem trước. Thêm --apply để ghi thật.',
);
process.exit(0);
