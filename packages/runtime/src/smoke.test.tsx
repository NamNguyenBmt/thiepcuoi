/**
 * Smoke test SSR: `npx tsx src/smoke.test.tsx`
 *
 * Render doc ra HTML tĩnh trong môi trường không có DOM. Nếu component nào
 * chạm vào window/document lúc render (thay vì trong effect) thì test này nổ —
 * đúng thứ cần bắt, vì trang thiệp công khai sẽ chạy SSR.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyDoc, createNode, validateDoc } from '@thiepcuoi/schema';
import type { InviteData, TemplateDoc } from '@thiepcuoi/schema';
import { CanvasRenderer } from './CanvasRenderer';
import { RuntimeProvider } from './context';
import { sanitizeInlineHtml, stripHtml } from './html';
import { snapWidth, imageUrl } from './image';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name}`, extra ?? '');
  }
}

// ── dựng doc thử ──────────────────────────────────────────────
const doc: TemplateDoc = createEmptyDoc('tpl_1', 'Mẫu thử', 'mau-thu');
doc.canvas.height = 1600;
doc.sections = [
  { id: 'sec-1', name: 'Bìa', top: 0, height: 800, background: { color: '#fff5f5' } },
  { id: 'sec-2', name: 'Thông tin', top: 800, height: 800, background: null },
];
doc.fonts.push({ family: 'Quicksand', source: { kind: 'google', name: 'Quicksand' }, weights: [400, 700] });
doc.effects.falling = { enabled: true, kind: 'heart', imgKey: null, density: 12, speed: 1 };

const nodes = [
  createNode('Text', 'sec-1', {
    text: '{{groom.shortName}} <b>&</b> {{bride.shortName}}',
    top: 80, left: 50, width: 400, height: 48, fontSize: 36, fontFamily: 'Quicksand',
  }, 'n-title'),
  createNode('Photo', 'sec-1', {
    imgKey: 'templates/tpl_1/cover.jpeg?crop=0,0,1600,2400',
    top: 200, left: 0, width: 500, height: 600, slot: 'cover',
  }, 'n-photo'),
  createNode('CountDown', 'sec-2', { top: 900, left: 60, targetDate: '2030-01-01T10:00:00.000Z' }, 'n-cd'),
  createNode('Calendar', 'sec-2', {
    top: 1050, left: 20, month: '2030-01-05T00:00:00.000Z', markedDates: ['2030-01-01T00:00:00.000Z'],
    fontFamily: 'Quicksand',
  }, 'n-cal'),
  createNode('RsvpForm', 'sec-2', { top: 1180, left: 75, fontFamily: 'Quicksand' }, 'n-form'),
  createNode('Gallery', 'sec-2', {
    top: 1200, left: 20, photos: [{ id: 'p1', imageKey: 'a.jpg', alt: 'Ảnh 1' }],
  }, 'n-gal'),
  createNode('GiftQr', 'sec-2', { top: 1500, left: 200, imgKey: 'icon.png' }, 'n-qr'),
];
for (const n of nodes) {
  doc.nodes[n.id] = n;
  doc.order.push(n.id);
}

const data = {
  groom: { shortName: 'Quang', fullName: 'Nguyễn Vinh Quang' },
  bride: { shortName: 'Vân', fullName: 'Nguyễn Thị Thuý Vân' },
  photos: { cover: 'invites/inv_9/cover.jpeg' },
} as unknown as InviteData;

// ── 1. doc hợp lệ ─────────────────────────────────────────────
console.log('1. schema');
check('không lỗi validate', validateDoc(doc).filter((i) => i.level === 'error').length === 0, validateDoc(doc));

// ── 2. render SSR ─────────────────────────────────────────────
console.log('2. render SSR (không có DOM)');
const html = renderToStaticMarkup(
  <RuntimeProvider value={{ assetBase: 'https://cdn.test', data, mode: 'render' }}>
    <CanvasRenderer doc={doc} eager />
  </RuntimeProvider>,
);
check('render ra được HTML', html.length > 500);
check('token đã thay', html.includes('Quang') && html.includes('Vân') && !html.includes('{{'));
check('ảnh dùng slot của thiệp, không phải ảnh mẫu', html.includes('invites/inv_9/cover.jpeg'));
check('có @import Google Font', html.includes('fonts.googleapis.com/css2?family=Quicksand'));
check('có keyframes', html.includes('@keyframes tc-wobble'));
check('section mang data-section-id', html.includes('data-section-id="sec-1"') && html.includes('data-section-id="sec-2"'));
check('node mang data-node-id', html.includes('data-node-id="n-title"'));
check('form có nút gửi', html.includes('Gửi xác nhận'));
check('lịch vẽ đủ 31 ngày tháng 1', html.includes('>31<'));
// KEYFRAMES_CSS luôn khai báo @keyframes tc-fall; thứ cần kiểm là không có
// phần tử nào ĐANG dùng nó, nên phải bỏ khối <style> ra trước khi so.
const body = (h: string) => h.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
check('hiệu ứng rơi không render ở SSR (tránh mismatch)', !body(html).includes('tc-fall'));
check('render mode có gắn animation vào', body(html).includes('transition-duration'));

// ── 3. mode editor ────────────────────────────────────────────
console.log('3. mode editor');
const editorHtml = renderToStaticMarkup(
  <RuntimeProvider value={{ assetBase: 'https://cdn.test', data: null, mode: 'editor' }}>
    <CanvasRenderer doc={doc} />
  </RuntimeProvider>,
);
check('editor giữ nguyên token để designer thấy', editorHtml.includes('{{groom.shortName}}'));
check('editor không chạy animation vào', !body(editorHtml).includes('transition-duration'));
check('editor vẫn mount mọi node dù không eager', editorHtml.includes('data-node-id="n-qr"'));
// Hồi quy: canvas của editor nằm trong khung cuộn có transform: scale() nên
// lazy-load không bao giờ kích hoạt — ảnh vừa gán sẽ mãi là ô trống.
check('editor tải ảnh ngay, không lazy', editorHtml.includes('loading="eager"') && !editorHtml.includes('loading="lazy"'));
check('trang thiệp vẫn lazy', html.includes('loading="lazy"'));

// ── 4. sanitize ───────────────────────────────────────────────
console.log('4. sanitize HTML');
check('bỏ thẻ script', sanitizeInlineHtml('<b>hi</b><script>alert(1)</script>') === '<b>hi</b>alert(1)');
check('bỏ onerror', sanitizeInlineHtml('<span onerror="x()">a</span>') === '<span>a</span>');
check('giữ style hợp lệ', sanitizeInlineHtml('<span style="color: red">a</span>') === '<span style="color: red">a</span>');
check('bỏ style có url()', sanitizeInlineHtml('<span style="background-image: url(x)">a</span>') === '<span>a</span>');
check('stripHtml', stripHtml('<b>Quang</b>&nbsp;&amp; Vân') === 'Quang &amp; Vân');

// ── 5. kích thước ảnh ─────────────────────────────────────────
console.log('5. ảnh');
check('snap lên bậc có sẵn', snapWidth(350, 2) === 800);
check('kẹp dpr ở 3', snapWidth(500, 10) === 1920);
check(
  'giữ crop, thêm resize/format',
  imageUrl('https://cdn.test', 'a.jpg?crop=0,0,10,10', 100, 2).includes('crop=0%2C0%2C10%2C10'),
  imageUrl('https://cdn.test', 'a.jpg?crop=0,0,10,10', 100, 2),
);

// -- 6. SSR khong truyen eager: phan dau phai co mat trong HTML --
// Hoi quy: truoc day moi section deu cho IntersectionObserver nen trang SSR tra
// ve HTML khong co lay mot node nao.
console.log('6. lazy-mount vs SSR');
const deepDoc: TemplateDoc = createEmptyDoc('tpl_2', 'Sau', 'sau');
deepDoc.canvas.height = 4000;
deepDoc.sections = [
  { id: 'top', name: 'Dau', top: 0, height: 800, background: null },
  { id: 'deep', name: 'Cuoi', top: 3000, height: 1000, background: null },
];
const nearNode = createNode('Text', 'top', { top: 40, left: 20, width: 300, height: 40, text: 'NOI-DUNG-DAU' }, 'n-near');
const farNode = createNode('Text', 'deep', { top: 3100, left: 20, width: 300, height: 40, text: 'NOI-DUNG-CUOI' }, 'n-far');
for (const n of [nearNode, farNode]) {
  deepDoc.nodes[n.id] = n;
  deepDoc.order.push(n.id);
}

const ssr = renderToStaticMarkup(
  <RuntimeProvider value={{ assetBase: 'https://cdn.test', mode: 'render' }}>
    <CanvasRenderer doc={deepDoc} />
  </RuntimeProvider>,
);
check('section dau render ngay o server', ssr.includes('NOI-DUNG-DAU'));
check('section xa van de lazy', !ssr.includes('NOI-DUNG-CUOI'));

const ssrAll = renderToStaticMarkup(
  <RuntimeProvider value={{ assetBase: 'https://cdn.test', mode: 'render' }}>
    <CanvasRenderer doc={deepDoc} eagerUntil={Infinity} />
  </RuntimeProvider>,
);
check('eagerUntil=Infinity render het', ssrAll.includes('NOI-DUNG-CUOI'));

console.log('7. hiệu ứng vào không được nuốt opacity của node');
const { entranceStyle } = await import('./animation');
const { baseStyle } = await import('./style');
const { baseProps } = await import('@thiepcuoi/schema');

const chuyenDong = {
  effectEnabled: true, effectType: 'slide-up' as const,
  effectDuration: 0.6, effectDelay: 0, effectEasing: 'ease-out' as const,
};

const luucHien = entranceStyle(chuyenDong, true);
check('đã hiện thì không nhắc tới opacity', !('opacity' in luucHien), Object.keys(luucHien));
check('đã hiện thì không nhắc tới filter', !('filter' in luucHien), Object.keys(luucHien));
check('đã hiện thì không nhắc tới willChange', !('willChange' in luucHien), Object.keys(luucHien));

const luucAn = entranceStyle(chuyenDong, false);
check('chưa hiện thì opacity = 0', luucAn.opacity === 0, luucAn.opacity);

/**
 * Đây mới là lỗi thật: `NodeShell` ghép hai style, mà một khoá `undefined` vẫn
 * đè lên giá trị trước đó. Tấm nền kính mờ 55% từng hoá trắng đặc vì vậy.
 */
const kinhMo = baseProps({ opacity: 0.34, backdropBlur: 16 });
const ghep = { ...baseStyle(kinhMo), ...entranceStyle(chuyenDong, true) };
check('ghép xong node vẫn giữ opacity riêng', ghep.opacity === 0.34, ghep.opacity);
check('ghép xong vẫn còn backdrop-filter', ghep.backdropFilter === 'blur(16px)', ghep.backdropFilter);

console.log(failed === 0 ? '\nPASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
