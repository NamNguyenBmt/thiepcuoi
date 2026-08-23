/**
 * Tách một thiệp "Ngọt ngào" thành hai: bản vu quy và bản thành hôn.
 *
 *   npm run split                             # liệt kê thiệp tách được
 *   npm run split -- <slug>                   # xem trước, KHÔNG ghi gì
 *   npm run split -- <slug> --apply           # tạo thật hai thiệp
 *
 * Đọc `DATABASE_URL` từ `apps/web/.env.prod.local` chứ không phải `.env.local`:
 * hai file cạnh nhau mà một cái trỏ vào máy bạn, một cái trỏ vào production —
 * nhầm chỗ là ghi dữ liệu thật vào Postgres cục bộ, hoặc tệ hơn là ngược lại.
 * Phải nêu tên file rõ ràng thì mới không có chuyện chạy nhầm vì quên.
 *
 * Hai thiệp mới dùng CHUNG một `InviteData` — đúng mô hình của mẫu: mẫu quyết
 * định in buổi nào, dữ liệu thì y nhau. Sửa giờ giấc sau này vẫn phải sửa hai
 * chỗ, nhưng không có tấm nào hiện sai buổi.
 */

import { loadEnvLocal } from './env.mts';

// Chỉ nạp file production, và không cho `.env.local` chen vào.
loadEnvLocal('.env.prod.local');

import type { InviteData } from '@thiepcuoi/schema';
import { getSql, describeDatabaseUrl } from '../lib/sql';
import { allSlugs, createInvite, getInviteBySlug, getTemplateBySlug, listInvites, getTemplateById } from '../lib/db';
import { uniqueSlug } from '../lib/slug';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const target = args.find((a) => !a.startsWith('--'));

const url = process.env.DATABASE_URL;
if (!url || url.includes('<')) {
  console.error('Chưa có DATABASE_URL trong apps/web/.env.prod.local — dán chuỗi kết nối vào đó đã.');
  process.exit(1);
}
console.log(`Database: ${describeDatabaseUrl()}`);
console.log(apply ? 'Chế độ: GHI THẬT (--apply)\n' : 'Chế độ: xem trước, không ghi gì\n');

await getSql();

const VARIANTS = [
  { suffix: 'vu-quy', templateSlug: 'ngot-ngao-vu-quy', label: 'Vu quy (nhà gái)' },
  { suffix: 'thanh-hon', templateSlug: 'ngot-ngao-thanh-hon', label: 'Thành hôn (nhà trai)' },
] as const;

/** Mọi thiệp đang dùng một mẫu họ "Ngọt ngào" */
async function splittable() {
  const invites = await listInvites();
  const out = [];
  for (const inv of invites) {
    const tpl = await getTemplateById(inv.templateId);
    if (tpl?.slug.startsWith('ngot-ngao')) out.push({ inv, tpl });
  }
  return out;
}

if (!target) {
  const rows = await splittable();
  if (rows.length === 0) {
    console.log('Không có thiệp nào đang dùng mẫu "Ngọt ngào".');
    process.exit(0);
  }
  console.log('Thiệp tách được:\n');
  for (const { inv, tpl } of rows) {
    const d = inv.data;
    console.log(`  ${inv.slug}`);
    console.log(`     mẫu       ${tpl.name} (${tpl.slug})`);
    console.log(`     cặp đôi   ${d.groom?.shortName ?? '?'} & ${d.bride?.shortName ?? '?'}`);
    console.log(`     sự kiện   ${(d.events ?? []).map((e, i) => `${i}=${e.title} ${e.datetime?.slice(0, 10)}`).join(' · ') || '(trống)'}`);
    console.log();
  }
  console.log('Chạy tiếp: npm run split -- <slug>');
  process.exit(0);
}

const source = await getInviteBySlug(target);
if (!source) {
  console.error(`Không có thiệp nào slug "${target}".`);
  process.exit(1);
}

const data = source.data as InviteData;
const events = data.events ?? [];

console.log(`Nguồn: ${source.slug} — ${data.groom?.shortName ?? '?'} & ${data.bride?.shortName ?? '?'}`);
console.log('\nThứ tự sự kiện mà mẫu "Ngọt ngào" quy ước:');
console.log('   events.0 → tiệc vu quy (nhà gái)   ·   events.1 → tiệc thành hôn (nhà trai)   ·   events.2 → lễ rước dâu');
console.log('\nThiệp này đang có:');
events.forEach((e, i) => {
  console.log(`   events.${i}  ${e.title || '(chưa đặt tên)'}  ${e.datetime?.slice(0, 16).replace('T', ' ')}Z  @ ${e.venue || '(chưa có)'}`);
});
if (events.length < 2) {
  console.error('\nThiệp có ít hơn 2 sự kiện — tách ra thì một tấm sẽ trống khối tiệc. Dừng.');
  process.exit(1);
}
if (events.length < 3) {
  console.warn('\nCẢNH BÁO: chưa có events.2 (lễ rước dâu) — mốc đó sẽ trống trong phần Trình tự.');
}

const taken = new Set(await allSlugs('invites'));
const plan = [];
for (const v of VARIANTS) {
  const tpl = await getTemplateBySlug(v.templateSlug);
  if (!tpl) {
    console.error(`\nThiếu mẫu "${v.templateSlug}" trong database này. Dừng.`);
    process.exit(1);
  }
  const existing = await getInviteBySlug(`${source.slug}-${v.suffix}`);
  const slug = existing ? existing.slug : uniqueSlug(`${source.slug}-${v.suffix}`, taken);
  taken.add(slug);
  plan.push({ ...v, tpl, slug, existing: !!existing });
}

console.log('\nSẽ tạo:');
for (const p of plan) {
  console.log(`   /thiep/${p.slug}   ${p.label}   [mẫu ${p.tpl.name}]${p.existing ? '   ← ĐÃ CÓ, bỏ qua' : ''}`);
}

if (!apply) {
  console.log('\nXem trước xong. Chạy lại kèm --apply để tạo thật.');
  process.exit(0);
}

const now = new Date().toISOString();
for (const p of plan) {
  if (p.existing) {
    console.log(`   = bỏ qua ${p.slug} (đã có)`);
    continue;
  }
  await createInvite({
    id: `inv-${randomUUID()}`,
    slug: p.slug,
    ownerId: source.ownerId,
    templateId: p.tpl.id,
    data,
    // Phát hành ngay: thiệp nháp thì mở link ra là 404, mà mục đích ở đây
    // đúng là để có link gửi đi.
    publishedAt: now,
  });
  console.log(`   + tạo ${p.slug}`);
}

console.log('\nXong. Hai link:');
for (const p of plan) console.log(`   /thiep/${p.slug}`);
process.exit(0);
