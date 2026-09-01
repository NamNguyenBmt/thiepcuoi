/**
 * Test lớp dữ liệu: `npx tsx test/api.test.ts`
 *
 * Chạy trên một file DB tạm nên không đụng dữ liệu dev. Không dựng server —
 * phần HTTP mỏng, còn thứ dễ hỏng là seed, nén doc và ghi song song.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'tcweb-'));
/**
 * Mặc định chạy trên PGlite trong RAM: mỗi lần chạy là một database sạch, không
 * cần cài gì. Đặt TEST_DATABASE_URL để chạy đúng bộ test này trên Postgres thật
 * — cùng SQL, khác driver.
 */
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
  // Xoá sạch lược đồ trước khi chạy: database thật không tự biến mất như RAM
  const { Client } = await import('pg');
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  await client.query('drop schema public cascade; create schema public');
  await client.end();
} else {
  process.env.PGLITE_DIR = 'memory://';
}
process.env.UPLOAD_DIR = join(dir, 'uploads');
console.log(`(driver: ${testUrl ? 'pg → Postgres thật' : 'PGlite trong RAM'})`);

const {
  listTemplates, getInviteBySlug, createRsvp, createWish, listWishes, listRsvps, updateTemplate,
  createTemplate, deleteTemplate, createInvite, updateInvite, getTemplateById,
} = await import('../lib/db');
const { unpackDoc, validateDoc, collectTokens, resolveTokens } = await import('@thiepcuoi/schema');
const { emptyInviteData: emptyInviteDataEarly } = await import('../lib/invite');
const emptyInviteData = emptyInviteDataEarly;

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name}`, extra ?? '');
  }
}

console.log('1. seed');
const templates = await listTemplates();
// "Cơ bản" + "Trọn vẹn" + ba biến thể của "Ngọt ngào" (gộp / vu quy / thành hôn)
check('có 5 template mồi', templates.length === 5, templates.length);
const full = templates.find((t) => t.slug === 'tron-ven');
check('có mẫu Trọn vẹn', !!full, templates.map((t) => t.slug));
const sweet = templates.find((t) => t.slug === 'ngot-ngao');
check('có mẫu Ngọt ngào', !!sweet, templates.map((t) => t.slug));
check(
  'có đủ hai biến thể tách thiệp',
  ['ngot-ngao-vu-quy', 'ngot-ngao-thanh-hon'].every((slug) => templates.some((t) => t.slug === slug)),
  templates.map((t) => t.slug),
);
const invite = await getInviteBySlug('quan-lan');
check('có thiệp mẫu', invite?.data.groom.shortName === 'Quân', invite?.slug);

// Tách thiệp: hai tấm cùng một đám cưới, mỗi tấm một mẫu riêng
const vuQuy = await getInviteBySlug('quan-lan-vu-quy');
const thanhHon = await getInviteBySlug('quan-lan-thanh-hon');
check('có thiệp vu quy', vuQuy?.templateId === 'tpl-ngot-ngao-vu-quy', vuQuy?.templateId);
check('có thiệp thành hôn', thanhHon?.templateId === 'tpl-ngot-ngao-thanh-hon', thanhHon?.templateId);
check(
  'hai thiệp tách dùng chung một bộ sự kiện',
  JSON.stringify(vuQuy?.data.events) === JSON.stringify(thanhHon?.data.events),
);

console.log('2. doc nén/giải nén được và hợp lệ');
const doc = unpackDoc(full!.docPacked);
const errors = validateDoc(doc).filter((i) => i.level === 'error');
check('không lỗi validate', errors.length === 0, errors);
check('gói nhỏ hơn JSON thô', full!.docPacked.length < JSON.stringify(doc).length);

const sweetDoc = unpackDoc(sweet!.docPacked);
const sweetErrors = validateDoc(sweetDoc).filter((i) => i.level === 'error');
check('mẫu Ngọt ngào không lỗi validate', sweetErrors.length === 0, sweetErrors);
check(
  'mẫu Ngọt ngào có bì thư mở màn',
  Object.values(sweetDoc.nodes).some((n) => n.type === 'Envelope'),
  Object.values(sweetDoc.nodes).map((n) => n.type),
);

console.log('3. token');
const tokens = collectTokens(doc);
check('liệt kê đủ token', tokens.includes('groom.shortName') && tokens.includes('events.0.venue'), tokens);
check(
  'resolve được đường dẫn qua mảng',
  resolveTokens('{{events.0.venue}}', invite!.data) === 'Tại tư gia nhà trai',
  resolveTokens('{{events.0.venue}}', invite!.data),
);
check(
  'thiệp mồi có đủ 4 sự kiện cho mẫu Trọn vẹn',
  invite!.data.events.length === 4,
  invite!.data.events.length,
);

console.log('4. RSVP');
const rsvp = await createRsvp({
  inviteId: invite!.id, name: 'Ngọc Anh', attending: true, attendeeCount: 2,
  guestSide: 'bride', transportation: null, pickupSlotId: null, message: 'Chúc hai bạn trăm năm hạnh phúc!',
});
check('lưu được', rsvp.id.length > 0);
const wishes = await listWishes(invite!.id);
check('lời chúc trong form vào luôn sổ lưu bút', wishes.length === 1 && wishes[0]!.name === 'Ngọc Anh', wishes);

await createRsvp({
  inviteId: invite!.id, name: 'Không lời chúc', attending: false, attendeeCount: 0,
  guestSide: null, transportation: null, pickupSlotId: null, message: '   ',
});
check('message rỗng thì không tạo lưu bút', (await listWishes(invite!.id)).length === 1);

console.log('5. ghi song song (transaction cua Postgres)');
await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    createWish({ inviteId: invite!.id, name: `Khách ${i}`, message: `Lời chúc ${i}` }),
  ),
);
const after = await listWishes(invite!.id);
check('không mất bản ghi nào khi ghi đồng thời', after.length === 9, after.length);
check('mới nhất lên đầu', after[0]!.createdAt >= after[after.length - 1]!.createdAt);

console.log('6. tách theo thiệp + toàn vẹn tham chiếu');
const tplForSecond = (await listTemplates())[0]!;
const second = await createInvite({
  id: 'inv-thu-hai', slug: 'thu-hai', ownerId: tplForSecond.ownerId,
  templateId: tplForSecond.id, data: emptyInviteData(), publishedAt: null,
});
await createWish({ inviteId: second.id, name: 'X', message: 'Y' });
check('không lẫn lời chúc giữa các thiệp', (await listWishes(invite!.id)).length === 9);
check('thiệp kia có đúng 1 lời chúc', (await listWishes(second.id)).length === 1);
check('rsvp cũng tách đúng', (await listRsvps(invite!.id)).length === 2);

// Khoá ngoại: bản JSON trước đây nhận bừa, Postgres thì chặn
let fkChan = false;
try {
  await createWish({ inviteId: 'inv-khong-ton-tai', name: 'X', message: 'Y' });
} catch {
  fkChan = true;
}
check('không ghi được lời chúc cho thiệp không tồn tại', fkChan);

await rm(dir, { recursive: true, force: true });
console.log('7. luu mau');
const t0 = (await listTemplates())[0]!;
check('revision khoi tao', t0.revision === 1, t0.revision);
const saved = await updateTemplate(t0.id, { docPacked: t0.docPacked, name: 'Ten moi' });
check('revision tang sau moi lan luu', saved?.revision === 2, saved?.revision);
check('doi duoc ten', saved?.name === 'Ten moi');
check('id la khong thi tra null', (await updateTemplate('khong-co', { name: 'x' })) === null);

console.log('8. kho anh');
const { isValidKey, parseTransform, storeUpload, renderAsset } = await import('../lib/storage');
const sharp = (await import('sharp')).default;

check('key hop le', isValidKey('uploads/f7fd5795-c688-4d78-9b96-26ec2b519f95.jpg'));
check('chan path traversal', !isValidKey('uploads/../../package.json'));
check('chan duoi la', !isValidKey('uploads/f7fd5795-c688-4d78-9b96-26ec2b519f95.exe'));
check('chan thu muc la', !isValidKey('khac/f7fd5795-c688-4d78-9b96-26ec2b519f95.jpg'));

const tf = parseTransform(new URLSearchParams('crop=10,20,30,40&resize=400x&format=webp&quality=80'));
check('doc duoc crop', tf.crop?.x === 10 && tf.crop?.w === 30, tf.crop);
check('doc duoc resize/format/quality', tf.resize === 400 && tf.format === 'webp' && tf.quality === 80, tf);
check('bo qua tham so rac', Object.keys(parseTransform(new URLSearchParams('resize=abc&quality=999'))).length === 0);

const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#7a2c2c' } }).png().toBuffer();
const ok = await storeUpload(new File([png], 'a.png', { type: 'image/png' }));
check('luu duoc PNG', !('error' in ok) && ok.width === 900 && ok.height === 600, ok);

const svg = await storeUpload(new File(['<svg onload="alert(1)"/>'], 'x.svg', { type: 'image/svg+xml' }));
check('tu choi SVG (nguy co XSS)', 'error' in svg && svg.status === 415, svg);

const big = await storeUpload(new File([new Uint8Array(13 * 1024 * 1024)], 'big.png', { type: 'image/png' }));
check('tu choi file qua nang', 'error' in big && big.status === 413, big);

const notImage = await storeUpload(new File(['khong phai anh'], 'a.png', { type: 'image/png' }));
check('tu choi file khong phai anh', 'error' in notImage && notImage.status === 400, notImage);

if (!('error' in ok)) {
  const small = await renderAsset(ok.key, ok.mime, { resize: 300, format: 'webp' });
  const meta = await sharp(small.body).metadata();
  check('resize hoat dong', meta.width === 300 && meta.format === 'webp', meta);
  const cropped = await renderAsset(ok.key, ok.mime, { crop: { x: 0, y: 0, w: 100, h: 50 } });
  check('crop hoat dong', (await sharp(cropped.body).metadata()).width === 100);
  const bigger = await renderAsset(ok.key, ok.mime, { resize: 2000, format: 'webp' });
  check('khong phong to qua anh goc', (await sharp(bigger.body).metadata()).width === 900);
}

console.log('8b. kho nhan ca file nhac');
const { isAudioMime } = await import('../lib/storage');

/** WAV 8-bit mono 0.1s tự dựng — chỉ cần đúng header, không cần nghe hay */
function wavThu(): Buffer {
  const soMau = 800;
  const b = Buffer.alloc(44 + soMau);
  b.write('RIFF', 0); b.writeUInt32LE(36 + soMau, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36); b.writeUInt32LE(soMau, 40);
  for (let i = 0; i < soMau; i++) b[44 + i] = 128 + Math.round(60 * Math.sin(i / 6));
  return b;
}

check('nhan dien mime nhac', isAudioMime('audio/mpeg') && isAudioMime('audio/mp4'));
check('anh khong bi coi la nhac', !isAudioMime('image/png'));
check('key duoi nhac hop le', isValidKey(`uploads/${crypto.randomUUID()}.mp3`));
check('key duoi la van bi chan', !isValidKey(`uploads/${crypto.randomUUID()}.exe`));

const wav = wavThu();
const nhac = await storeUpload(new File([wav], 'nen.wav', { type: 'audio/wav' }));
check('luu duoc file nhac', !('error' in nhac) && nhac.key.endsWith('.wav'), nhac);

if (!('error' in nhac)) {
  // Âm thanh không có kích thước; bảng assets vẫn đòi số nên phải là 0, không phải NaN
  check('nhac khong co kich thuoc', nhac.width === 0 && nhac.height === 0, nhac);
  check('giu nguyen so byte, khong nen lai', nhac.bytes === wav.length, nhac.bytes);

  // Tham số của ảnh lọt vào URL nhạc thì phải bị bỏ qua, không được đưa qua sharp
  const phucVu = await renderAsset(nhac.key, nhac.mime, { resize: 300, format: 'webp' });
  check('phuc vu nhac dung mime', phucVu.mime === 'audio/wav', phucVu.mime);
  check('tra ve dung byte da luu', phucVu.body.equals(wav));
}

console.log('9. mat khau va phan quyen');
const { hashPassword, verifyPassword, canEdit } = await import('../lib/auth');
const { rateLimit, resetRateLimits } = await import('../lib/ratelimit');

const hash = await hashPassword('matkhau123');
check('hash khong chua mat khau goc', !hash.includes('matkhau123'), hash.slice(0, 20));
check('dung mat khau thi qua', await verifyPassword('matkhau123', hash));
check('sai mat khau thi truot', !(await verifyPassword('matkhau124', hash)));
check('hash rong/hong thi truot', !(await verifyPassword('x', 'khong-co-dau-hai-cham')));

const hash2 = await hashPassword('matkhau123');
check('cung mat khau ra hash khac nhau (salt ngau nhien)', hash !== hash2);
check('hash thu hai van verify duoc', await verifyPassword('matkhau123', hash2));

const admin = { id: 'a', role: 'admin' } as any;
const owner = { id: 'b', role: 'user' } as any;
const other = { id: 'c', role: 'user' } as any;
check('chu so huu sua duoc', canEdit(owner, 'b'));
check('nguoi khac khong sua duoc', !canEdit(other, 'b'));
check('admin sua duoc cua nguoi khac', canEdit(admin, 'b'));

resetRateLimits();
const hits: boolean[] = [];
for (let i = 0; i < 4; i++) hits.push((await rateLimit('test-ip', 3, 60_000)).ok);
check('chan sau khi vuot nguong', JSON.stringify(hits) === '[true,true,true,false]', hits);
check('khoa khac khong bi anh huong', (await rateLimit('test-ip-2', 3, 60_000)).ok);
const blocked = await rateLimit('test-ip', 3, 60_000);
check('bao thoi gian cho', blocked.retryAfter > 0 && blocked.retryAfter <= 60, blocked);
resetRateLimits();
check('reset thi cho lai tu dau', (await rateLimit('test-ip', 3, 60_000)).ok);

console.log('10. slug');
const { toSlug, uniqueSlug, validateSlug } = await import('../lib/slug');

check('bo dau tieng Viet', toSlug('Mẫu Đơn Giản của Tôi') === 'mau-don-gian-cua-toi', toSlug('Mẫu Đơn Giản của Tôi'));
check('xu ly chu d gach ngang', toSlug('Đám cưới Đức') === 'dam-cuoi-duc', toSlug('Đám cưới Đức'));
check('gop dau cau thanh mot gach', toSlug('Quân  &  Vân!!') === 'quan-van', toSlug('Quân  &  Vân!!'));
check('khong de gach o hai dau', !toSlug('  --xin chao--  ').startsWith('-'));
check('cat do dai', toSlug('a'.repeat(100)).length === 60);

check('slug moi giu nguyen', uniqueSlug('Tuấn Mai', []) === 'tuan-mai');
check('trung thi them so', uniqueSlug('Tuấn Mai', ['tuan-mai']) === 'tuan-mai-2');
check('trung tiep thi tang so', uniqueSlug('Tuấn Mai', ['tuan-mai', 'tuan-mai-2']) === 'tuan-mai-3');
check('ten toan ky tu la van ra slug', uniqueSlug('!!!', []) === 'thiep');
check('slug qua ngan bi tu choi', validateSlug('ab') === null);
check('slug hop le duoc chuan hoa', validateSlug('Tuấn Mai') === 'tuan-mai');

console.log('11. lam sach InviteData');
const { parseInviteData } = await import('../lib/invite');

const dirty = parseInviteData({
  groom: { fullName: '  Nguyễn Văn A  ', shortName: 'A', khongPhaiTruong: 'bo di' },
  events: Array.from({ length: 12 }, (_, i) => ({ title: `E${i}`, datetime: 'khong-phai-ngay' })),
  accounts: Array.from({ length: 9 }, () => ({ name: 'x' })),
  photos: { cover: 'uploads/a.jpg', rong: '', 'so-khong-phai-chuoi': 123 },
  message: 'm'.repeat(5000),
  linhTinh: 'bo di',
});
check('cat khoang trang', dirty.groom.fullName === 'Nguyễn Văn A', dirty.groom.fullName);
check('bo truong la', !('khongPhaiTruong' in dirty.groom) && !('linhTinh' in (dirty as any)));
check('gioi han so su kien', dirty.events.length === 6, dirty.events.length);
check('ngay khong doc duoc thi de rong', dirty.events[0]!.datetime === '', dirty.events[0]!.datetime);
check('gioi han so tai khoan', dirty.accounts.length === 4, dirty.accounts.length);
check('bo photo rong / khong phai chuoi', Object.keys(dirty.photos).join(',') === 'cover', dirty.photos);
check('cat do dai loi nhan', dirty.message.length === 2000, dirty.message.length);
check('thieu co dau thi ra chuoi rong', dirty.bride.fullName === '');
check('thiep moi co san 1 su kien', emptyInviteData().events.length === 1);

console.log('12. tao mau va thiep');
const base = (await listTemplates())[0]!;
const tplMoi = await createTemplate({
  id: 'tpl-test', slug: 'tpl-test', name: 'Thu', ownerId: base.ownerId,
  docPacked: base.docPacked, thumbnail: null, usageCount: 0,
});
check('mau moi bat dau tu revision 1', tplMoi.revision === 1);
check('xoa duoc mau chua ai dung', await deleteTemplate('tpl-test'));
check('xoa roi thi khong tim thay', (await getTemplateById('tpl-test')) === null);

const usageTruoc = base.usageCount;
await createInvite({
  id: 'inv-test', slug: 'inv-test', ownerId: base.ownerId, templateId: base.id,
  data: emptyInviteData(), publishedAt: null,
});
check('tao thiep lam tang usageCount cua mau', (await getTemplateById(base.id))!.usageCount === usageTruoc + 1);
check('khong xoa duoc mau con thiep dung', !(await deleteTemplate(base.id)));

const published = await updateInvite('inv-test', { publishedAt: new Date().toISOString() });
check('phat hanh duoc', Boolean(published?.publishedAt));
check('sua thiep khong ton tai tra null', (await updateInvite('inv-khong-co', { slug: 'x' })) === null);

console.log('13. kho file (blobstore)');
const { getBlobStore } = await import('../lib/blobstore');
const blob = await getBlobStore();
console.log('   ', blob.describe());

const key = `uploads/${crypto.randomUUID()}.png`;
const noiDung = Buffer.from('noi dung thu ' + Date.now());
await blob.put(key, noiDung, 'image/png');
check('doc lai dung byte da ghi', (await blob.get(key)).equals(noiDung));

await blob.remove(key);
let daXoa = false;
try {
  await blob.get(key);
} catch {
  daXoa = true;
}
check('xoa roi thi khong doc duoc nua', daXoa);

let khongCo = false;
try {
  await blob.get(`uploads/${crypto.randomUUID()}.png`);
} catch {
  khongCo = true;
}
check('key khong ton tai thi nem loi', khongCo);

console.log('14. kiem cau hinh');
const { checkConfig } = await import('../lib/config-check');

const prodThieu = checkConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
const loiProd = prodThieu.filter((i) => i.level === 'error').map((i) => i.key);
check('production thieu DATABASE_URL la LOI', loiProd.includes('DATABASE_URL'), loiProd);
check('production thieu S3 la LOI', loiProd.includes('S3_BUCKET'), loiProd);

const devThieu = checkConfig({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
check('dev thieu ca hai chi la canh bao', devThieu.every((i) => i.level === 'warn'), devThieu);

const nuaVoi = checkConfig({
  NODE_ENV: 'production', DATABASE_URL: 'postgres://x', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k',
} as NodeJS.ProcessEnv);
check(
  'cau hinh S3 do dang bi bat',
  nuaVoi.some((i) => i.level === 'error' && i.message.includes('S3_SECRET_ACCESS_KEY')),
  nuaVoi,
);

const dayDu = checkConfig({
  NODE_ENV: 'production', DATABASE_URL: 'postgres://x',
  S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's',
} as NodeJS.ProcessEnv);
check('du bien thi khong con loi', dayDu.filter((i) => i.level === 'error').length === 0, dayDu);

console.log('15. đăng ký tài khoản');
const { createUser, getUserByEmail } = await import('../lib/db');
const { parseRegisterInput, isRegisterError, MIN_PASSWORD } = await import('../lib/register');

const validInput = parseRegisterInput({ email: 'Nguoi.Moi@Vidu.LOCAL ', password: 'matkhaudaydu', name: '  Người Mới  ' });
check('email duoc chuan hoa thuong + cat khoang trang', !isRegisterError(validInput) && validInput.email === 'nguoi.moi@vidu.local', validInput);
check('ten duoc cat khoang trang', !isRegisterError(validInput) && validInput.name === 'Người Mới', validInput);

check('email khong hop le bi tu choi', isRegisterError(parseRegisterInput({ email: 'khong-phai-email', password: 'matkhaudaydu', name: 'X' })));
check(
  `mat khau ngan hon ${MIN_PASSWORD} bi tu choi`,
  isRegisterError(parseRegisterInput({ email: 'a@b.com', password: '1234567', name: 'X' })),
);
check('thieu ten bi tu choi', isRegisterError(parseRegisterInput({ email: 'a@b.com', password: 'matkhaudaydu', name: '   ' })));

if (!isRegisterError(validInput)) {
  const newUser = await createUser({
    id: `usr-${crypto.randomUUID()}`,
    email: validInput.email,
    name: validInput.name,
    passwordHash: await hashPassword(validInput.password),
    role: 'user',
  });
  check('tai khoan moi co role user', newUser.role === 'user', newUser.role);
  check('tim lai duoc bang email', (await getUserByEmail(validInput.email))?.id === newUser.id);

  let trung = false;
  try {
    await createUser({ id: `usr-${crypto.randomUUID()}`, email: validInput.email, name: 'Khac', passwordHash: 'x', role: 'user' });
  } catch {
    trung = true;
  }
  check('email trung bi rang buoc unique chan', trung);
}

console.log('16. captcha tu host');
const { createCaptcha, verifyCaptcha, resetCaptchaState } = await import('../lib/captcha');
resetCaptchaState();

const c1 = createCaptcha();
check('cau hoi dang "so + so"', /^\d+ \+ \d+$/.test(c1.question), c1.question);
const [a1, b1] = c1.question.split(' + ').map(Number) as [number, number];
const dungC1 = String(a1 + b1);

check('tra loi sai thi truot', !verifyCaptcha(c1.token, String(a1 + b1 + 1)));
check('tra loi dung thi qua', verifyCaptcha(c1.token, dungC1));
check('dung lai token da dung thi truot (chan replay)', !verifyCaptcha(c1.token, dungC1));

const c2 = createCaptcha();
const bitCuoi = c2.token.slice(-1);
const badToken = c2.token.slice(0, -1) + (bitCuoi === 'A' ? 'B' : 'A');
check('token bi sua chu ky thi truot', !verifyCaptcha(badToken, '0'));

const het = createCaptcha(-1); // het han ngay luc sinh
const [a3, b3] = het.question.split(' + ').map(Number) as [number, number];
check('token het han thi truot', !verifyCaptcha(het.token, String(a3 + b3)));

check('token khong doc duoc (khong phai base64) thi truot', !verifyCaptcha('!!!khong-hop-le!!!', '5'));

/**
 * Next đóng gói mỗi route riêng nên cùng file captcha.ts bị nạp thành nhiều
 * bản trong một tiến trình. Query string làm Node nạp thêm một bản mới, đúng
 * như /api/captcha và /api/auth/register nhìn thấy nhau.
 */
const banKhac = await import('../lib/captcha?ban-nap-thu-hai');
const cheo = createCaptcha();
const [a4, b4] = cheo.question.split(' + ').map(Number) as [number, number];
check(
  'token ky o ban nap nay verify duoc o ban nap khac',
  banKhac.verifyCaptcha(cheo.token, String(a4 + b4)),
);
check('sổ token đã dùng cũng chung giữa các bản nạp', !verifyCaptcha(cheo.token, String(a4 + b4)));
check('thieu answer thi truot', !verifyCaptcha(c2.token, ''));
check('token khong phai chuoi thi truot', !verifyCaptcha(undefined, '5'));

console.log('17. redirect slug thiep');
const { getSlugRedirectTarget } = await import('../lib/db');

const baseTpl = (await listTemplates())[0]!;
const r1 = await createInvite({
  id: 'inv-redirect-test', slug: 'redir-a', ownerId: baseTpl.ownerId, templateId: baseTpl.id,
  data: emptyInviteData(), publishedAt: new Date().toISOString(),
});
check('tao thiep voi slug ban dau', r1.slug === 'redir-a');

const r2 = await updateInvite(r1.id, { slug: 'redir-b' }, r1.slug);
check('doi slug thanh cong', r2?.slug === 'redir-b', r2?.slug);
check('slug cu tra ve dung invite id', (await getSlugRedirectTarget('redir-a')) === r1.id);
check('slug moi khong nam trong bang redirect', (await getSlugRedirectTarget('redir-b')) === null);

const r3 = await updateInvite(r1.id, { slug: 'redir-c' }, 'redir-b');
check('doi slug lan hai', r3?.slug === 'redir-c', r3?.slug);
check('slug redir-a (doi tu lau) van con tro dung', (await getSlugRedirectTarget('redir-a')) === r1.id);
check('slug redir-b (vua la slug song) gio tro dung', (await getSlugRedirectTarget('redir-b')) === r1.id);

const noChange = await updateInvite(r1.id, { data: emptyInviteData() }, r1.slug);
check('sua du lieu khong doi slug thi khong dung toi redirect', noChange?.slug === 'redir-c');

// Tra truc tiep luon uu tien hon bang redirect: thiep khac chiem lai duoc slug cu
const reclaimed = await createInvite({
  id: 'inv-redirect-other', slug: 'redir-a', ownerId: baseTpl.ownerId, templateId: baseTpl.id,
  data: emptyInviteData(), publishedAt: new Date().toISOString(),
});
check('thiep khac chiem lai duoc slug cu (khong bi bang redirect chan)', reclaimed.slug === 'redir-a');
check(
  'tra truc tiep ra thiep moi, khong phai muc redirect cu',
  (await getInviteBySlug('redir-a'))?.id === reclaimed.id,
);

// on conflict: doi qua lai nhieu lan cung mot old_slug khong duoc loi khoa trung
const cyc = await createInvite({
  id: 'inv-redirect-cycle', slug: 'redir-x', ownerId: baseTpl.ownerId, templateId: baseTpl.id,
  data: emptyInviteData(), publishedAt: new Date().toISOString(),
});
await updateInvite(cyc.id, { slug: 'redir-y' }, 'redir-x');
await updateInvite(cyc.id, { slug: 'redir-x' }, 'redir-y');
const backAndForth = await updateInvite(cyc.id, { slug: 'redir-z' }, 'redir-x');
check('doi qua lai nhieu lan khong loi (on conflict)', backAndForth?.slug === 'redir-z', backAndForth);
check('old_slug ghi de van tro dung invite', (await getSlugRedirectTarget('redir-x')) === cyc.id);

console.log('18. rate limit pluggable (redis)');
const { selectLimiterKind, createRedisLimiter } = await import('../lib/ratelimit');
type RedisLikeT = Parameters<typeof createRedisLimiter>[0];

check('khong co REDIS_URL thi chon memory', selectLimiterKind({} as NodeJS.ProcessEnv) === 'memory');
check('co REDIS_URL thi chon redis', selectLimiterKind({ REDIS_URL: 'redis://x' } as NodeJS.ProcessEnv) === 'redis');

/**
 * Client giả trong bộ nhớ, chỉ cài đúng 5 lệnh của RedisLike — đủ để chứng
 * minh thuật toán trong createRedisLimiter đúng mà không cần dựng Redis thật.
 */
function fakeRedis(): RedisLikeT {
  const sets = new Map<string, Map<string, number>>();
  const get = (key: string) => sets.get(key) ?? new Map<string, number>();

  return {
    zremrangebyscore: async (key, min, max) => {
      const set = get(key);
      for (const [member, score] of set) {
        if (score >= min && score <= max) set.delete(member);
      }
      sets.set(key, set);
    },
    zcard: async (key) => get(key).size,
    zadd: async (key, score, member) => {
      const set = get(key);
      set.set(member, score);
      sets.set(key, set);
    },
    pexpire: async () => {},
    oldestScore: async (key) => {
      const set = get(key);
      return set.size === 0 ? null : Math.min(...set.values());
    },
  };
}

const redisLimiter = createRedisLimiter(fakeRedis(), 'fake redis');
check('mo ta dung nhu truyen vao', redisLimiter.describe() === 'fake redis');

let pingOk = true;
try {
  await redisLimiter.ping();
} catch {
  pingOk = false;
}
check('ping qua duoc khi redis song', pingOk);

// Redis chết thì health check phải biết, không được im lặng coi như bình thường
const redisChet = createRedisLimiter(
  { ...fakeRedis(), zcard: async () => { throw new Error('ECONNREFUSED'); } },
  'redis hong',
);
let pingNem = false;
try {
  await redisChet.ping();
} catch {
  pingNem = true;
}
check('ping nem loi khi redis chet', pingNem);

const redisHits: boolean[] = [];
for (let i = 0; i < 4; i++) redisHits.push((await redisLimiter.hit('rk', 3, 60_000)).ok);
check('redis: chan sau khi vuot nguong', JSON.stringify(redisHits) === '[true,true,true,false]', redisHits);
check('redis: khoa khac khong bi anh huong', (await redisLimiter.hit('rk-2', 3, 60_000)).ok);
const redisBlocked = await redisLimiter.hit('rk', 3, 60_000);
check('redis: bao thoi gian cho', redisBlocked.retryAfter > 0 && redisBlocked.retryAfter <= 60, redisBlocked);

console.log('19. mo ta DATABASE_URL (chan doan, khong lo bi mat)');
const { describeDatabaseUrl } = await import('../lib/sql');

const moTa = describeDatabaseUrl('postgresql://postgres.abc:sieu-bi-mat@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres');
check('khong lo mat khau', !moTa.includes('sieu-bi-mat'), moTa);
check('khong lo user', !moTa.includes('postgres.abc'), moTa);
check('co host va cong', moTa === 'aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres', moTa);
check('khong co URL thi bao dung PGlite', describeDatabaseUrl('').includes('PGlite'));
check('URL hong thi bao ro', describeDatabaseUrl('postgresql://u:pa#ss@host:5432/db').includes('percent-encode'));

console.log('19b. doi mau cho thiep da co');
const dsMau = await listTemplates();
const mauA = dsMau[0]!;
const mauB = dsMau.find((t) => t.id !== mauA.id)!;

const thiepDoiMau = await createInvite({
  id: 'inv-doi-mau', slug: 'doi-mau', ownerId: mauA.ownerId,
  templateId: mauA.id, data: emptyInviteData(), publishedAt: null,
});
const dungA = (await getTemplateById(mauA.id))!.usageCount;
const dungB = (await getTemplateById(mauB.id))!.usageCount;

const sauKhiDoi = await updateInvite(thiepDoiMau.id, { templateId: mauB.id });
check('thiep tro sang mau moi', sauKhiDoi?.templateId === mauB.id, sauKhiDoi?.templateId);
check('mau cu bot mot luot dung', (await getTemplateById(mauA.id))!.usageCount === dungA - 1);
check('mau moi them mot luot dung', (await getTemplateById(mauB.id))!.usageCount === dungB + 1);

// Sửa nội dung mà không nêu templateId thì không được âm thầm đổi mẫu
const giuNguyen = await updateInvite(thiepDoiMau.id, { slug: 'doi-mau-2' }, 'doi-mau');
check('sua thu khac khong lam doi mau', giuNguyen?.templateId === mauB.id, giuNguyen?.templateId);
check('so luot dung khong bi cong them', (await getTemplateById(mauB.id))!.usageCount === dungB + 1);

console.log('19c. gan nhac: nhan ban mau chung, khong dung vao mau goc');
const { attachAudio, isAttachError, cloneName, isSharedTemplate } = await import('../lib/attach-audio');

const nhacThu = wavThu();
const mauChung = (await listTemplates()).find((t) => t.slug === 'ngot-ngao')!;

// Chủ thiệp là người khác chủ mẫu — đúng tình huống trên production
const chuThiep = await createUser({
  id: 'usr-gan-nhac', email: 'gan-nhac@vidu.local', name: 'Chu thiep',
  passwordHash: 'x', role: 'user',
});
const thiepNhac = await createInvite({
  id: 'inv-gan-nhac', slug: 'gan-nhac', ownerId: chuThiep.id,
  templateId: mauChung.id, data: emptyInviteData(), publishedAt: null,
});
const docGocTruoc = (await getTemplateById(mauChung.id))!.docPacked;

const ganA = await attachAudio({
  inviteSlug: thiepNhac.slug, bytes: nhacThu, fileName: 'nen.wav', mime: 'audio/wav',
});
check('gan nhac chay duoc', !isAttachError(ganA), ganA);

if (!isAttachError(ganA)) {
  check('co nhan ban mau', ganA.cloned);
  check('ban sao doi chu', ganA.template.ownerId === chuThiep.id, ganA.template.ownerId);
  check('ban sao khac id mau goc', ganA.template.id !== mauChung.id);
  check('ban sao khac slug mau goc', ganA.template.slug !== mauChung.slug, ganA.template.slug);
  check('ten ban sao kem slug thiep', ganA.template.name === cloneName(mauChung.name, thiepNhac.slug), ganA.template.name);
  check('thiep da tro sang ban sao', ganA.invite.templateId === ganA.template.id);

  // Điều quan trọng nhất: mẫu chung không suy suyển
  const mauGocSau = (await getTemplateById(mauChung.id))!;
  check('mau chung khong bi sua', mauGocSau.docPacked === docGocTruoc);
  check('mau chung van khong co nhac', unpackDoc(mauGocSau.docPacked).audio === null);

  // Danh tính phải nằm trong chính doc, không chỉ ở cột database
  const docBanSao = unpackDoc(ganA.template.docPacked);
  check('doc ban sao mang id moi', docBanSao.id === ganA.template.id, docBanSao.id);
  check('doc ban sao mang slug moi', docBanSao.slug === ganA.template.slug, docBanSao.slug);

  check('doc ban sao co nhac', docBanSao.audio?.key === ganA.asset.key, docBanSao.audio);
  check('nhac dat lap lai', docBanSao.audio?.loop === true);
  check('nhac khong tu phat', docBanSao.audio?.autoplay === false);
  check('nhac luu dung duoi file', ganA.asset.key.endsWith('.wav'), ganA.asset.key);
}

// Chạy lần hai: mẫu đã là của chủ thiệp thì sửa thẳng, không đẻ thêm bản sao
const soMauTruoc = (await listTemplates()).length;
const ganB = await attachAudio({
  inviteSlug: thiepNhac.slug, bytes: nhacThu, fileName: 'nen2.wav', mime: 'audio/wav',
});
check('lan hai chay duoc', !isAttachError(ganB), ganB);
if (!isAttachError(ganB) && !isAttachError(ganA)) {
  check('lan hai khong nhan ban nua', !ganB.cloned);
  check('lan hai van dung mau do', ganB.template.id === ganA.template.id);
  check('khong de them mau', (await listTemplates()).length === soMauTruoc, soMauTruoc);
  check('nhac moi thay nhac cu', unpackDoc(ganB.template.docPacked).audio?.key === ganB.asset.key);
}

const ganHong = await attachAudio({
  inviteSlug: 'khong-he-ton-tai', bytes: nhacThu, fileName: 'nen.wav', mime: 'audio/wav',
});
check('slug la thi bao loi chu khong nem', isAttachError(ganHong), ganHong);

// Cái bẫy thật: mẫu dựng sẵn thuộc về admin, mà admin cũng tự tạo thiệp cho
// mình. Chỉ so owner_id thì ở đây kết luận "mẫu của bạn mà" rồi sửa thẳng vào
// hàng mọi cặp đôi khác đang dùng.
const mauChung2 = (await listTemplates()).find((t) => t.slug === 'tron-ven')!;
const thiepCuaAdmin = await createInvite({
  id: 'inv-admin-tu-lam', slug: 'admin-tu-lam', ownerId: mauChung2.ownerId,
  templateId: mauChung2.id, data: emptyInviteData(), publishedAt: null,
});
check('mau dung san van bi coi la dung chung', await isSharedTemplate(mauChung2, mauChung2.ownerId));

const docChung2Truoc = mauChung2.docPacked;
const ganC = await attachAudio({
  inviteSlug: thiepCuaAdmin.slug, bytes: nhacThu, fileName: 'nen.wav', mime: 'audio/wav',
});
check('cung chu van nhan ban', !isAttachError(ganC) && ganC.cloned, ganC);
check(
  'mau dung san khong bi gan nhac',
  (await getTemplateById(mauChung2.id))!.docPacked === docChung2Truoc,
);

// Bản sao vừa tạo thì thuộc về chủ thiệp và không mang dấu dựng sẵn
if (!isAttachError(ganC)) {
  check('ban sao khong bi coi la dung chung', !(await isSharedTemplate(ganC.template, thiepCuaAdmin.ownerId)));
}

console.log('20. once(): chi nho khi khoi tao thanh cong');
const { once } = await import('../lib/once');

let soLanTao = 0;
const luonOk = once(async () => {
  soLanTao++;
  return `lan ${soLanTao}`;
});
check('goi hai lan chi tao mot lan', (await luonOk.get()) === 'lan 1' && (await luonOk.get()) === 'lan 1');
check('nhieu loi goi dong thoi cung chi tao mot lan', soLanTao === 1, soLanTao);
luonOk.reset();
check('reset thi tao lai', (await luonOk.get()) === 'lan 2');

// Đây mới là lỗi cần sửa: hỏng lần đầu không được nhớ lại mãi
let hong = true;
let soLanThu = 0;
const chapChon = once(async () => {
  soLanThu++;
  if (hong) throw new Error('ECONNREFUSED');
  return 'da noi duoc';
});

let nemLoi = false;
try {
  await chapChon.get();
} catch {
  nemLoi = true;
}
check('lan dau hong thi nem loi', nemLoi);

let nemLoiLanHai = false;
try {
  await chapChon.get();
} catch {
  nemLoiLanHai = true;
}
check('van hong thi van nem loi', nemLoiLanHai && soLanThu === 2, soLanThu);

hong = false;
check('khi da song lai thi noi duoc, khong tra ve loi da cache', (await chapChon.get()) === 'da noi duoc');
check('song roi thi lai nho, khong tao them', (await chapChon.get()) === 'da noi duoc' && soLanThu === 3, soLanThu);

console.log('21. getSql() thu lai sau khi ket noi hong');
const { getSql, resetSql } = await import('../lib/sql');
const urlThat = process.env.DATABASE_URL;

resetSql();
// Cổng 1 trên localhost: bị từ chối ngay, không phải chờ DNS
process.env.DATABASE_URL = 'postgres://u:p@127.0.0.1:1/khong-co';
let ketNoiHong = false;
try {
  await getSql();
} catch {
  ketNoiHong = true;
}
check('database khong nghe thi nem loi', ketNoiHong);

if (urlThat === undefined) delete process.env.DATABASE_URL;
else process.env.DATABASE_URL = urlThat;

const sqlSauKhiHong = await getSql();
const { rows: thuLai } = await sqlSauKhiHong.query<{ n: number }>('select 1 as n');
check('database song lai thi dung duoc ngay, khong can khoi dong lai', thuLai[0]?.n === 1, thuLai);

console.log('22. migrate bo qua khi schema da dung');
const { migrate } = await import('../lib/sql');
const { readFile: docFile } = await import('node:fs/promises');
const ddlText = await docFile('lib/schema.sql', 'utf8');

const sqlThat = await getSql();
let soCau = 0;
const demSql = {
  query: ((text: string, params?: unknown[]) => {
    soCau++;
    return sqlThat.query(text, params);
  }) as typeof sqlThat.query,
  transaction: sqlThat.transaction,
};

// getSql() phía trên đã migrate rồi, nên lần này phải nhận ra và dừng sớm
await migrate(demSql);
check('database dung phien ban roi thi chi ton 1 cau lenh', soCau === 1, soCau);

const { rows: daGhi } = await sqlThat.query<{ ddl: string }>('select ddl from schema_state where id = 1');
check('ghi lai nguyen van schema.sql', daGhi[0]?.ddl === ddlText);

// Database chua tung migrate (hoac schema.sql vua doi) thi phai chay day du
await sqlThat.query('delete from schema_state');
soCau = 0;
await migrate(demSql);
check('database chua dung phien ban thi chay het DDL', soCau > 10, soCau);

const { rows: ghiLai } = await sqlThat.query<{ ddl: string }>('select ddl from schema_state where id = 1');
check('chay xong thi ghi nhan lai', ghiLai[0]?.ddl === ddlText);

soCau = 0;
await migrate(demSql);
check('ngay sau do lai bo qua duoc', soCau === 1, soCau);

console.log(failed === 0 ? '\nPASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
