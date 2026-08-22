/**
 * Smoke test không cần test runner: `npx tsx src/smoke.test.ts`
 * Kiểm tra: round-trip nén, validate bắt lỗi, token binding.
 */

import { createEmptyDoc, createNode } from './defaults';
import { packDoc, unpackDoc, validateDoc, collectTokens, resolveTokens, assetUrl } from './serialize';
import type { InviteData } from './types';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`, extra ?? '');
  }
}

const doc = createEmptyDoc('tpl_1', 'Mẫu thử', 'mau-thu');
doc.fonts.push({ family: 'Quicksand', source: { kind: 'google', name: 'Quicksand' }, weights: [400, 700] });

const title = createNode('Text', 'sec-1', {
  text: '{{groom.shortName}} & {{bride.shortName}}',
  top: 80, left: 50, width: 400, height: 48, fontSize: 36, fontFamily: 'Quicksand',
}, 'n1');
const photo = createNode('Photo', 'sec-1', {
  imgKey: 'templates/tpl_1/cover.jpeg?crop=0,0,1600,2400',
  top: 0, left: 0, width: 500, height: 700, slot: 'cover',
}, 'n2');
const form = createNode('RsvpForm', 'sec-1', { top: 720, left: 75 }, 'n3');

for (const n of [title, photo, form]) {
  doc.nodes[n.id] = n;
  doc.order.push(n.id);
}
doc.canvas.height = 800;

console.log('1. validate doc hợp lệ');
const issues = validateDoc(doc);
check('không có lỗi', issues.filter((i) => i.level === 'error').length === 0, issues);

console.log('2. round-trip nén');
const packed = packDoc(doc);
const back = unpackDoc(packed);
const raw = JSON.stringify(doc);
check('giữ nguyên nội dung', JSON.stringify(back) === raw);
check(`nén nhỏ hơn (${raw.length}B → ${packed.length}B)`, packed.length < raw.length);

console.log('3. validate bắt được lỗi');
const broken = unpackDoc(packed);
const brokenTitle = broken.nodes['n1'];
if (brokenTitle?.type === 'Text') brokenTitle.props.fontFamily = 'FontChuaKhaiBao';
broken.nodes['n2']!.sectionId = 'sec-khong-ton-tai';
delete (broken.nodes as any)['n3'];
const errs = validateDoc(broken).filter((i) => i.level === 'error');
check('font chưa khai báo', errs.some((e) => e.message.includes('FontChuaKhaiBao')), errs);
check('section không tồn tại', errs.some((e) => e.path === 'nodes.n2.sectionId'), errs);
check('order trỏ tới node đã xoá', errs.some((e) => e.path === 'order'), errs);

console.log('4. token binding');
check('liệt kê token', collectTokens(doc).join(',') === 'bride.shortName,groom.shortName');
const data = { groom: { shortName: 'Quang' }, bride: { shortName: 'Vân' } } as unknown as InviteData;
check('resolve', resolveTokens(title.props.text, data) === 'Quang & Vân');
check('token thiếu → rỗng khi render', resolveTokens('{{groom.father}}', data) === '');
check('token thiếu → giữ nguyên trong editor', resolveTokens('{{x.y}}', data, 'editor') === '{{x.y}}');

console.log('5. asset url');
check(
  'giữ crop có sẵn, thêm resize/format',
  assetUrl('https://cdn.example.com', photo.props.imgKey, { resize: 750, format: 'webp', quality: 90 })
    === 'https://cdn.example.com/templates/tpl_1/cover.jpeg?crop=0%2C0%2C1600%2C2400&resize=750x&format=webp&quality=90',
  assetUrl('https://cdn.example.com', photo.props.imgKey, { resize: 750, format: 'webp', quality: 90 }),
);

console.log(failed === 0 ? '\nPASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
