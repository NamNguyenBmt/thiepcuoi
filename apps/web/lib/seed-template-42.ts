/**
 * Mẫu "Ngọt ngào" — thiệp cưới tông hồng phấn, mở bằng bì thư.
 *
 * Bố cục dựng lại theo phong cách thiệp cưới Hàn hiện đang phổ biến: nền kem
 * hồng liền mạch từ đầu tới cuối, ảnh tràn viền xen kẽ khối chữ, và mỗi phần
 * trượt vào từ một hướng khi cuộn tới.
 *
 * Ba điểm khác mẫu "Trọn vẹn":
 *   - **Bì thư**: khách phải chạm mở mới cuộn được. Không phải trang trí —
 *     nó là thứ biến việc mở thiệp thành một hành động, và giữ khách lại ở màn
 *     chào đủ lâu để đọc tên cô dâu chú rể.
 *   - **Nền là của canvas, không phải của section.** Section ở đây chỉ để
 *     mount theo lô khi cuộn; nền trong suốt nên node được phép nằm vắt qua
 *     ranh giới mà không bị vạch nền của section sau cắt ngang.
 *   - **Hoạ tiết vẽ bằng code** (`seed-decor.ts`) chứ không phải ảnh nhập về.
 *
 * Toạ độ tuyệt đối trong canvas 500 × 8382. Mọi nội dung cụ thể là token hoặc
 * slot ảnh — một thiết kế dùng cho mọi cặp đôi.
 */

import { createEmptyDoc, createNode } from '@thiepcuoi/schema';
import type { TemplateNode, TemplateDoc, EntranceEffect } from '@thiepcuoi/schema';
import { SEED_KEYS } from './seed-assets';

// ─────────────────────────── Bảng màu ───────────────────────────

const CREAM = '#fdf9f7';   // nền toàn thiệp — trắng ngà, không trắng tinh
const DEEP = '#8b2f30';    // đỏ rượu — tên, tiêu đề lớn
const BRICK = '#834343';   // đỏ nhạt hơn — chữ nhỏ in hoa
const INK = '#3b3232';     // chữ thân
const ROSE = '#e49696';    // hồng nhấn — nút, tim, mốc giờ
const BLUSH = '#dfbaba';   // hồng phấn — khối nền lớn
const PAPER = '#fbf5f5';   // hồng rất nhạt — khung ảnh, đủ tách khỏi nền
const COUNTDOWN = '#a3403d';
const RULE = '#999999';

// ─────────────────────────── Font ───────────────────────────
//
// Mẫu gốc dùng font thư pháp thương mại. Ở đây thay bằng Google Fonts có bộ
// tiếng Việt đầy đủ — thiếu bộ này thì dấu mũ và dấu thanh rơi về font hệ
// thống, và một dòng chữ sẽ pha hai kiểu chữ khác nhau.

const SANS = 'Quicksand';
const SERIF = 'Playfair Display';
const SCRIPT = 'Dancing Script';
const FORMAL = 'Great Vibes';
const SYS = 'Arial';

// ─────────────────────────── Section ───────────────────────────

/**
 * Mốc dọc của từng section.
 *
 * Khối tiệc chứa hai buổi (vu quy + thành hôn) nên dài hơn bản một buổi đúng
 * `EVENT_GROWTH`. Thay vì sửa tay toạ độ của gần một trăm node bên dưới — việc
 * sai một con số là lệch cả nửa tấm thiệp — mọi node thuộc các section sau khối
 * tiệc được đẩy xuống một lượt lúc dựng doc.
 */
const EVENT_GROWTH = 140;

const Y = {
  cover: 0,
  intro: 720,
  vows: 1420,
  event: 1900,
  sweet: 2560 + EVENT_GROWTH,
  bride: 3400 + EVENT_GROWTH,
  groom: 4180 + EVENT_GROWTH,
  date: 5000 + EVENT_GROWTH,
  timeline: 5820 + EVENT_GROWTH,
  rsvp: 6090 + EVENT_GROWTH,
  gift: 7300 + EVENT_GROWTH,
  thanks: 8000 + EVENT_GROWTH,
  end: 8382 + EVENT_GROWTH,
};

/** Section nằm sau khối tiệc — node của chúng viết theo toạ độ cũ rồi đẩy xuống */
const SHIFTED_SECTIONS = new Set([
  'sec-sweet', 'sec-bride', 'sec-groom', 'sec-date',
  'sec-timeline', 'sec-rsvp', 'sec-gift', 'sec-thanks',
]);

// ─────────────────────────── Hiệu ứng vào ───────────────────────────

/** Mẫu gốc dùng đúng một nhịp cho mọi node: 1.3s ease-out. Giữ nguyên nhịp đó. */
function fx(effectType: EntranceEffect, effectDelay = 0, effectDuration = 1.3) {
  return {
    transition: {
      effectType,
      effectDuration,
      effectDelay,
      effectEasing: 'ease-out' as const,
      effectEnabled: true,
    },
  };
}

/** Chữ và ảnh vào cùng hướng nhưng ảnh chậm hơn 0.2s, nên chữ luôn tới trước */
const IN_UP = fx('slide-up');
const IN_LEFT = fx('slide-left');
const IN_RIGHT = fx('slide-right');
const MEDIA_UP = fx('slide-up', 0.2);
const MEDIA_LEFT = fx('slide-left', 0.2);
const MEDIA_RIGHT = fx('slide-right', 0.2);
const STILL = fx('fade', 0);

// ─────────────────────────── Helper ───────────────────────────

interface TextOpts {
  top: number;
  left: number;
  width: number;
  height: number;
  text: string;
  font?: string;
  size?: number;
  color?: string;
  weight?: '300' | '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
  spacing?: number;
  lineHeight?: string;
  upper?: boolean;
  rotation?: number;
  z?: number;
  anim?: ReturnType<typeof fx>;
}

function text(section: string, o: TextOpts) {
  return createNode('Text', section, {
    top: o.top, left: o.left, width: o.width, height: o.height,
    text: o.text,
    fontFamily: o.font ?? SANS,
    fontSize: o.size ?? 16,
    fontWeight: o.weight ?? '500',
    color: o.color ?? INK,
    textAlign: o.align ?? 'center',
    letterSpacing: `${o.spacing ?? 0}px`,
    lineHeight: o.lineHeight ?? 'normal',
    textTransform: o.upper ? 'uppercase' : 'none',
    rotation: o.rotation ?? 0,
    zIndex: o.z ?? 0,
    ...(o.anim ?? IN_UP),
  });
}

interface BoxOpts {
  top: number;
  left: number;
  width: number;
  height: number;
  fill?: string;
  opacity?: number;
  border?: [number, string];
  radius?: number;
  rotation?: number;
  z?: number;
  shadow?: boolean;
  anim?: ReturnType<typeof fx>;
}

/** Khối màu / khung viền — hoạ tiết hình học chiếm phần lớn mẫu này */
function box(section: string, o: BoxOpts) {
  return createNode('Shape', section, {
    top: o.top, left: o.left, width: o.width, height: o.height,
    shapeKind: 'rect',
    imgKey: '',
    backgroundColor: o.fill ?? 'transparent',
    opacity: o.opacity ?? 1,
    borderSize: o.border?.[0] ?? 0,
    borderColor: o.border?.[1] ?? '',
    borderRadius: [o.radius ?? 0, o.radius ?? 0, o.radius ?? 0, o.radius ?? 0],
    rotation: o.rotation ?? 0,
    zIndex: o.z ?? 0,
    hasShadow: o.shadow ?? false,
    boxShadow: { offsetX: 0, offsetY: 6, blur: 18, spread: 0, color: 'rgba(139, 47, 48, 0.10)' },
    ...(o.anim ?? MEDIA_UP),
  });
}

interface DecorOpts {
  top: number;
  left: number;
  width: number;
  height: number;
  img: string;
  rotation?: number;
  opacity?: number;
  z?: number;
  anim?: ReturnType<typeof fx>;
}

/** Hoạ tiết PNG đã tô sẵn màu (xem seed-decor.ts) */
function decor(section: string, o: DecorOpts) {
  return createNode('Shape', section, {
    top: o.top, left: o.left, width: o.width, height: o.height,
    shapeKind: 'img',
    imgKey: o.img,
    opacity: o.opacity ?? 1,
    rotation: o.rotation ?? 0,
    zIndex: o.z ?? 0,
    ...(o.anim ?? MEDIA_UP),
  });
}

interface PhotoOpts {
  top: number;
  left: number;
  width: number;
  height: number;
  img: string;
  slot?: string;
  mask?: string;
  /** Nền và lề trắng quanh ảnh — biến mất cùng ảnh khi thiệp không có ảnh đó */
  bg?: string;
  pad?: number;
  z?: number;
  anim?: ReturnType<typeof fx>;
}

function photo(section: string, o: PhotoOpts) {
  return createNode('Photo', section, {
    top: o.top, left: o.left, width: o.width, height: o.height,
    imgKey: o.img,
    slot: o.slot ?? null,
    maskShapeImg: o.mask ?? null,
    objectFit: 'cover',
    isReplaceable: true,
    backgroundColor: o.bg ?? 'transparent',
    padding: [o.pad ?? 0, o.pad ?? 0, o.pad ?? 0, o.pad ?? 0],
    zIndex: o.z ?? 0,
    ...(o.anim ?? MEDIA_UP),
  });
}

/** Gạch dọc mảnh ngăn khối chữ — lặp lại ở ba chỗ trong mẫu */
function vrule(section: string, top: number, left: number, height: number, color = DEEP, anim = MEDIA_RIGHT) {
  return box(section, { top, left, width: 2, height, fill: color, anim });
}

/** Gạch ngang mảnh trên/dưới khối ngày cưới */
function hrule(section: string, top: number, left: number, width: number) {
  return box(section, { top, left, width, height: 1.5, fill: RULE, anim: IN_UP });
}

/**
 * Một khối tiệc: tiêu đề, giờ, khối ngày lớn, âm lịch, nơi tổ chức và một bản
 * đồ nhỏ nép vào góc.
 *
 * Bản đồ để nhỏ và lệch hẳn sang một bên, hai khối thì đổi bên — mắt bắt được
 * ngay là "có hai tiệc", thay vì hai tấm bản đồ to bằng nhau xếp chồng nhìn
 * như một khối bị lặp. Chữ và bản đồ chia đôi bề ngang nên không đè nhau.
 */
function partyBlock(
  section: string,
  top: number,
  ev: string,
  side: 'left' | 'right',
  z: number,
) {
  const mapLeft = side === 'left' ? 16 : 352;
  const textLeft = side === 'left' ? 160 : 14;
  const textWidth = 324;

  return [
    text(section, {
      top, left: 25.5, width: 448, height: 53,
      text: `{{${ev}.title}}`, font: SERIF, size: 26, weight: '700', upper: true, z,
    }),
    text(section, {
      top: top + 45, left: 25.5, width: 448, height: 43,
      text: `Vào lúc {{${ev}.time}} {{${ev}.weekday}}`,
      font: SERIF, size: 21, weight: '700', upper: true, z,
    }),
    hrule(section, top + 92, 17.3, 169.7),
    hrule(section, top + 92, 306, 180.5),
    text(section, {
      top: top + 99, left: 17.3, width: 169.7, height: 46,
      text: `{{${ev}.monthText}}`, font: SERIF, size: 30, weight: '700', upper: true, z, anim: IN_RIGHT,
    }),
    text(section, {
      top: top + 99, left: 306, width: 180.5, height: 46,
      text: `Năm {{${ev}.year}}`, font: SERIF, size: 30, weight: '700', upper: true, z, anim: IN_LEFT,
    }),
    text(section, {
      top: top + 79, left: 142.8, width: 205, height: 106,
      text: `{{${ev}.day}}`, font: SERIF, size: 85, weight: '700', color: DEEP, z,
    }),
    hrule(section, top + 152, 17.3, 169.7),
    hrule(section, top + 152, 306, 180.5),
    text(section, {
      top: top + 188, left: 32.3, width: 448, height: 40,
      text: `({{${ev}.lunarText}})`, font: SERIF, size: 19, weight: '400', z,
    }),

    // Bản đồ nhỏ trong góc, có khung trắng mảnh như một tấm ảnh dán vào thiệp
    box(section, {
      top: top + 236, left: mapLeft, width: 132, height: 99, fill: '#ffffff', z,
      anim: side === 'left' ? MEDIA_RIGHT : MEDIA_LEFT,
    }),
    createNode('Map', section, {
      top: top + 240, left: mapLeft + 4, width: 124, height: 91, zIndex: z + 1,
      mode: 'embed',
      label: `Bản đồ tới {{${ev}.venue}}`,
      query: `{{${ev}.venue}} {{${ev}.address}}`,
      fontFamily: SANS, fontSize: 12,
      ...fx('slide-up', 0.3),
    }),
    text(section, {
      top: top + 238, left: textLeft, width: textWidth, height: 30,
      text: `{{${ev}.venue}}`, font: SERIF, size: 22, weight: '700', upper: true, z,
    }),
    text(section, {
      top: top + 270, left: textLeft, width: textWidth, height: 62,
      text: `{{${ev}.address}}`, font: SANS, size: 13, lineHeight: '1.6', z,
    }),
  ];
}

/**
 * Một từ in hoa có bóng: bản sẫm nằm dưới, lệch 2px sang phải, bản trắng đè lên.
 * Đây là cách khối "YES! I DO" nổi lên trên nền ảnh mà không cần text-shadow —
 * bóng cứng, cùng font, nên vẫn sắc nét ở mọi cỡ màn hình.
 */
function shadowedWord(
  section: string, top: number, left: number, width: number,
  word: string, shadowColor: string, z: number,
) {
  // Bóng lệch 1.6px chứ không 2.3: nét thư pháp mảnh hơn nét chữ in hoa, lệch
  // nhiều thì hai bản tách hẳn ra thành hai chữ chồng nhau chứ không ra bóng.
  const common = {
    top, width, height: 70, text: word, font: FORMAL, size: 58,
    weight: '400' as const, anim: IN_LEFT,
  };
  return [
    text(section, { ...common, left: left + 1.6, color: shadowColor, z }),
    text(section, { ...common, left, color: '#ffffff', z: z + 1 }),
  ];
}

/**
 * Một mốc trong trình tự buổi lễ: hoạ tiết + tim + giờ và việc.
 * `img` là xe hoa / tay ôm tim / ly champagne.
 */
function timelineRow(section: string, top: number, img: string, size: number, label: string, z: number) {
  return [
    decor(section, { top: top + 4, left: 171.1 + (41 - size) / 2, width: size, height: size, img, z: z + 1 }),
    decor(section, { top: top + 13, left: 220, width: 22.5, height: 22.5, img: SEED_KEYS.heartRose, z, anim: MEDIA_UP }),
    text(section, {
      top: top + 6, left: 251, width: 240, height: 46,
      text: label, font: SERIF, size: 15, color: '#000000', align: 'left',
      lineHeight: '1.45', z: z + 2,
    }),
  ];
}

/**
 * Một thẻ chuyển khoản: ảnh tròn trong vòng nét đứt, khối nền bo góc, tên và
 * số tài khoản, mã QR. `side` quyết định ảnh nằm trái hay phải.
 */
function giftCard(
  section: string,
  top: number,
  side: 'left' | 'right',
  opts: { role: string; nameToken: string; accountToken: string; photoKey: string; photoSlot: string; qrSlot: string; z: number },
) {
  const { z } = opts;
  const ringLeft = side === 'left' ? 24.4 : 318.1;
  const cardLeft = side === 'left' ? 201 : 21.6;
  const qrLeft = side === 'left' ? 358.5 : 33.9;
  // Cột chữ nằm gọn giữa mép thẻ và mã QR — không chừa chỗ thì tên dài đè lên QR
  const textMid = side === 'left' ? 278 : 222;

  return [
    decor(section, { top, left: ringLeft, width: 150, height: 150, img: SEED_KEYS.dashedRing, z, anim: STILL }),
    // Ảnh nhỏ hơn vòng 10px mỗi bên: vòng phải hở ra mới nhìn ra là nét đứt
    photo(section, {
      top: top + 10, left: ringLeft + 10, width: 130, height: 130,
      img: opts.photoKey, slot: opts.photoSlot, mask: SEED_KEYS.circleMask, z: z + 1, anim: STILL,
    }),
    box(section, {
      top: top + 5.1, left: cardLeft, width: 278, height: 150,
      fill: '#e0e0e0', opacity: 0.48, radius: 30, shadow: true, z: z + 2, anim: STILL,
    }),
    // QR để trống, chỉ hiện khi thiệp thật sự có ảnh QR. Gắn sẵn QR mẫu vào đây
    // thì một tấm thiệp thật chưa nhập tài khoản sẽ trưng ra mã QR giả cho khách
    // quét. Nền trắng nằm trên chính node ảnh, không phải node riêng — node riêng
    // sẽ ở lại thành một ô trắng rỗng khi không có QR.
    photo(section, {
      top: top + 18.7, left: qrLeft, width: 102.3, height: 102.3,
      img: '', slot: opts.qrSlot, bg: '#ffffff', pad: 3.3, z: z + 16, anim: STILL,
    }),
    text(section, {
      top: top + 25.3, left: textMid - 75, width: 150, height: 24,
      text: opts.role, size: 18, color: '#000000', z: z + 3, anim: STILL,
    }),
    text(section, {
      top: top + 58, left: textMid - 85, width: 170, height: 26,
      text: opts.nameToken, size: 18, color: '#000000', z: z + 4, anim: STILL,
    }),
    text(section, {
      top: top + 92, left: textMid - 80, width: 160, height: 20,
      text: opts.accountToken, size: 12, color: '#000000', z: z + 5, anim: STILL,
    }),
  ];
}

// ─────────────────────────── Mẫu ───────────────────────────

export function sweetTemplate(): TemplateDoc {
  const doc = createEmptyDoc('tpl-ngot-ngao', 'Ngọt ngào', 'ngot-ngao');

  doc.canvas.height = Y.end;
  doc.canvas.background = CREAM;

  /**
   * Section ở mẫu này KHÔNG có nền. Nền là của canvas, một màu chạy suốt 8382px.
   * Nhờ vậy node được phép vắt qua ranh giới section — mà mẫu này thì đầy node
   * như vậy — mà không bị nền của section kế tiếp vẽ đè lên.
   */
  doc.sections = [
    { id: 'sec-cover', name: 'Bì thư', top: Y.cover, height: Y.intro - Y.cover, background: null },
    { id: 'sec-intro', name: 'Lời mời', top: Y.intro, height: Y.vows - Y.intro, background: null },
    { id: 'sec-vows', name: 'Lễ thành hôn', top: Y.vows, height: Y.event - Y.vows, background: null },
    { id: 'sec-event', name: 'Tiệc cưới', top: Y.event, height: Y.sweet - Y.event, background: null },
    { id: 'sec-sweet', name: 'Sweet wedding', top: Y.sweet, height: Y.bride - Y.sweet, background: null },
    { id: 'sec-bride', name: 'Cô dâu', top: Y.bride, height: Y.groom - Y.bride, background: null },
    { id: 'sec-groom', name: 'Chú rể', top: Y.groom, height: Y.date - Y.groom, background: null },
    { id: 'sec-date', name: 'Save the date', top: Y.date, height: Y.timeline - Y.date, background: null },
    { id: 'sec-timeline', name: 'Trình tự', top: Y.timeline, height: Y.rsvp - Y.timeline, background: null },
    { id: 'sec-rsvp', name: 'Xác nhận', top: Y.rsvp, height: Y.gift - Y.rsvp, background: null },
    { id: 'sec-gift', name: 'Mừng cưới', top: Y.gift, height: Y.thanks - Y.gift, background: null },
    { id: 'sec-thanks', name: 'Cảm ơn', top: Y.thanks, height: Y.end - Y.thanks, background: null },
  ];

  doc.fonts = [
    { family: SANS, source: { kind: 'google', name: 'Quicksand' }, weights: [400, 500, 600, 700] },
    { family: SERIF, source: { kind: 'google', name: 'Playfair Display' }, weights: [400, 500, 600, 700] },
    { family: SCRIPT, source: { kind: 'google', name: 'Dancing Script' }, weights: [400, 500, 700] },
    { family: FORMAL, source: { kind: 'google', name: 'Great Vibes' }, weights: [400] },
  ];

  // Mẫu này không có tim rơi: bì thư đã là hiệu ứng mở màn, thêm tim rơi nữa
  // thì hai chuyển động tranh nhau ngay giây đầu tiên.
  doc.effects.falling = { enabled: false, kind: 'heart', imgKey: null, density: 14, speed: 0.8 };

  // Nhạc nền để trống — chủ thiệp tải mp3 lên rồi đặt `doc.audio` là nút nhạc
  // hiện ra. Không kèm sẵn bài nào vì nhạc có bản quyền riêng.
  doc.audio = null;

  const nodes: TemplateNode[] = [
    // ═══════════ Bì thư ═══════════
    text('sec-cover', {
      top: 12.3, left: 10, width: 480, height: 22,
      text: 'WEDDING INVITATION', font: SYS, size: 16, color: BRICK, spacing: 9,
    }),
    text('sec-cover', {
      top: 53.9, left: 10, width: 480, height: 34,
      text: 'Thiệp mời cưới', font: SYS, size: 26, color: BRICK, spacing: 2, upper: true,
    }),
    text('sec-cover', {
      top: 114, left: 31, width: 177, height: 54,
      text: '{{bride.shortName}}', font: FORMAL, size: 39, weight: '400', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-cover', {
      top: 114, left: 280.5, width: 177, height: 54,
      text: '{{groom.shortName}}', font: FORMAL, size: 39, weight: '400', color: '#000000', anim: IN_LEFT,
    }),
    text('sec-cover', {
      top: 118.5, left: 200.5, width: 97.4, height: 54,
      text: '&amp;', font: FORMAL, size: 38, weight: '400', color: BRICK,
    }),
    decor('sec-cover', {
      top: 189.3, left: 219.7, width: 53.3, height: 52, img: SEED_KEYS.doubleHappiness,
      z: 73, anim: STILL,
    }),
    createNode('Envelope', 'sec-cover', {
      top: 294.7, left: 33.3, width: 430.1, height: 286.7, zIndex: 77,
      imgKey: SEED_KEYS.couple,
      slot: 'couple',
      sealImg: SEED_KEYS.waxSeal,
      envelopeColor: '#812927',
      flapColor: '#812927',
      pocketSideColor: '#a33f3d',
      pocketBottomColor: '#a84644',
      heartColor: '#d00000',
      lockScrollUntilOpened: true,
      dismissAfter: 3.4,
      ...fx('slide-up', 0.3),
    }),
    text('sec-cover', {
      top: 630.4, left: 110.6, width: 282.5, height: 45,
      text: 'Chạm để mở thiệp', font: SCRIPT, size: 25, color: DEEP, z: 80,
      anim: fx('slide-up', 0.4, 1.6),
    }),

    // ═══════════ Lời mời ═══════════
    photo('sec-intro', {
      top: 720, left: 2, width: 495, height: 697, img: SEED_KEYS.cover, slot: 'cover',
    }),
    box('sec-intro', {
      top: 1049.7, left: 31.9, width: 448.4, height: 346.5, fill: '#ffffff', opacity: 0.55,
    }),
    createNode('CountDown', 'sec-intro', {
      top: 1025.9, left: 108.5, width: 310, height: 65,
      targetDate: '{{events.1.datetime}}',
      themeColor: COUNTDOWN, color: '#ffffff',
      fontFamily: SYS, fontSize: 14, spacing: 8,
      expiredText: 'Chúng mình đã về chung một nhà',
      ...fx('slide-up', 0.3),
    }),
    text('sec-intro', {
      top: 1135.3, left: 38.3, width: 442, height: 31,
      text: 'INVITATION', font: SYS, size: 26, color: DEEP, spacing: 11,
    }),
    text('sec-intro', {
      top: 1192.4, left: 74, width: 365, height: 194,
      text:
        'Gửi đến gia đình và bạn bè thân mến,<br>' +
        'Cảm ơn bạn đã dành thời gian quý báu để cùng chúng mình chung vui ' +
        'trong ngày đặc biệt này. Chúng mình vô cùng biết ơn vì luôn có sự ' +
        'đồng hành và ủng hộ của bạn, và thật vinh hạnh khi được chia sẻ ' +
        'niềm hạnh phúc của chúng mình cùng bạn.<br>' +
        'Trân trọng kính mời bạn đến dự lễ cưới của chúng mình',
      font: SANS, size: 15, color: DEEP, lineHeight: '1.62',
    }),

    // ═══════════ Lễ thành hôn ═══════════
    vrule('sec-vows', 1425.5, 52, 74),
    text('sec-vows', {
      top: 1491, left: 100.8, width: 248.5, height: 34,
      text: '{{groom.fullName}}', font: SCRIPT, size: 37, weight: '700', color: DEEP,
    }),
    text('sec-vows', {
      top: 1509, left: 8, width: 90, height: 31,
      text: 'Lễ', font: SCRIPT, size: 26, weight: '700', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1543.8, left: 153, width: 206.5, height: 49,
      text: '&amp;', font: SCRIPT, size: 38, weight: '700', color: DEEP,
    }),
    text('sec-vows', {
      top: 1551.9, left: 8, width: 90, height: 33,
      text: 'Thành', font: SCRIPT, size: 26, weight: '700', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1598, left: 8, width: 90, height: 33,
      text: 'Hôn', font: SCRIPT, size: 26, weight: '700', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1607.4, left: 231.5, width: 248.5, height: 48,
      text: '{{bride.fullName}}', font: SCRIPT, size: 37, weight: '700', color: DEEP, anim: IN_LEFT,
    }),
    vrule('sec-vows', 1656, 52, 67),

    text('sec-vows', {
      top: 1729.9, left: 0, width: 201.5, height: 31,
      text: 'Nhà Trai', font: SERIF, size: 23, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1773.2, left: 3.9, width: 193.9, height: 31,
      text: 'Ông: {{groom.father}}', font: SANS, size: 18, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1802.2, left: 3.9, width: 193.9, height: 23,
      text: 'Bà: {{groom.mother}}', font: SANS, size: 18, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1835, left: 3.9, width: 193.9, height: 23,
      text: '{{groom.address}}', font: SANS, size: 18, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1729.9, left: 296.1, width: 201.5, height: 31,
      text: 'Nhà Gái', font: SERIF, size: 23, color: '#000000', anim: IN_LEFT,
    }),
    text('sec-vows', {
      top: 1773.2, left: 265.1, width: 235, height: 31,
      text: 'Ông: {{bride.father}}', font: SANS, size: 18, color: '#000000', anim: IN_LEFT,
    }),
    text('sec-vows', {
      top: 1802.2, left: 263.6, width: 235, height: 23,
      text: 'Bà: {{bride.mother}}', font: SANS, size: 18, color: '#000000', anim: IN_LEFT,
    }),
    text('sec-vows', {
      top: 1835, left: 280.5, width: 193.9, height: 23,
      text: '{{bride.address}}', font: SANS, size: 18, color: '#000000', anim: IN_LEFT,
    }),

    // ═══════════ Tiệc cưới ═══════════
    // Tiêu đề lấy từ chính sự kiện, không đóng cứng: mỗi đám cưới gọi tên hai
    // buổi tiệc một kiểu, và mẫu không nên áp đặt cách gọi của một nhà nào.
    ...partyBlock('sec-event', 1904.2, 'events.0', 'left', 0),
    ...partyBlock('sec-event', 2304.2, 'events.1', 'right', 2),

    // ═══════════ Sweet wedding ═══════════
    box('sec-sweet', {
      top: 2608.5, left: 256.3, width: 242.3, height: 866.7, fill: BLUSH, z: 2, anim: MEDIA_LEFT,
    }),
    decor('sec-sweet', {
      top: 2577.7, left: 22.5, width: 70.1, height: 56.1, img: SEED_KEYS.sparkle, z: 4, anim: MEDIA_RIGHT,
    }),
    box('sec-sweet', {
      top: 2681.1, left: 134, width: 352.7, height: 348.7,
      fill: BLUSH, opacity: 0.15, border: [4, BRICK], z: 5,
    }),
    photo('sec-sweet', {
      top: 2695.3, left: 150.3, width: 320.2, height: 320.2, img: SEED_KEYS.album[0]!, slot: 'album1', z: 6,
    }),
    text('sec-sweet', {
      top: 2608.5, left: 24.4, width: 463.8, height: 53,
      text: 'SWEET WEDDING', font: SYS, size: 23, color: BRICK, spacing: 16, z: 7,
    }),
    // Ảnh vuông bắt đầu ở x=150, nên hai chữ này phải nằm gọn bên trái mốc đó —
    // canh trái thay vì canh giữa, không thì chữ trôi vào giữa tấm ảnh.
    text('sec-sweet', {
      top: 2738.7, left: 14, width: 200, height: 70,
      text: 'Marry', font: FORMAL, size: 58, weight: '400', color: BRICK,
      align: 'left', z: 8, anim: IN_RIGHT,
    }),
    text('sec-sweet', {
      top: 2822, left: 44, width: 180, height: 70,
      text: 'me?', font: FORMAL, size: 58, weight: '400', color: BRICK,
      align: 'left', z: 9, anim: IN_RIGHT,
    }),
    photo('sec-sweet', {
      top: 2931.5, left: 11, width: 300, height: 450, img: SEED_KEYS.bride, slot: 'bride', z: 11,
    }),
    decor('sec-sweet', {
      top: 3156.7, left: 361.9, width: 122.6, height: 80.9, img: SEED_KEYS.hearts, z: 16, anim: MEDIA_LEFT,
    }),
    // Mỗi chữ hai bản: bản sẫm lệch sang phải 2px làm bóng cho bản trắng đè lên
    ...shadowedWord('sec-sweet', 3200, 296, 196, 'Yes!', BRICK, 10),
    ...shadowedWord('sec-sweet', 3274, 296, 196, 'I do', DEEP, 12),

    // ═══════════ Cô dâu ═══════════
    text('sec-bride', {
      top: 3423.1, left: -8, width: 370.2, height: 52,
      text: 'About us', font: SCRIPT, size: 48, color: DEEP, z: 17,
    }),
    decor('sec-bride', {
      top: 3425.8, left: 54.5, width: 61.7, height: 49.4, img: SEED_KEYS.sparkle, z: 30, anim: MEDIA_RIGHT,
    }),
    photo('sec-bride', {
      top: 3484.7, left: 192.3, width: 292.2, height: 385.7, img: SEED_KEYS.bride, slot: 'bride', z: 21,
    }),
    box('sec-bride', {
      top: 3509.7, left: 42.1, width: 168.3, height: 320,
      fill: PAPER, border: [2, DEEP], z: 20, anim: MEDIA_RIGHT,
    }),
    text('sec-bride', {
      top: 3569.5, left: 45, width: 145, height: 32,
      text: '{{bride.fullName}}', font: SCRIPT, size: 20, weight: '700', z: 22, anim: IN_RIGHT,
    }),
    text('sec-bride', {
      top: 3605.4, left: 45, width: 145, height: 32,
      text: '{{bride.birthday}}', font: SCRIPT, size: 20, weight: '700', z: 23, anim: IN_RIGHT,
    }),
    text('sec-bride', {
      top: 3659.9, left: 45, width: 145, height: 40,
      text: '{{bride.address}}', font: SCRIPT, size: 13, weight: '700', z: 24, anim: IN_RIGHT,
    }),
    box('sec-bride', {
      top: 3914.5, left: 10.4, width: 417.9, height: 229.3,
      fill: PAPER, border: [1, DEEP], z: 26,
    }),
    photo('sec-bride', {
      top: 3891.4, left: 20.9, width: 372.2, height: 235.5, img: SEED_KEYS.couple, slot: 'couple', z: 27,
    }),
    text('sec-bride', {
      top: 3960.4, left: 349.1, width: 172.1, height: 59,
      text: 'Bride', font: FORMAL, size: 36, weight: '400', color: BLUSH, spacing: 2,
      rotation: 90, z: 29, anim: IN_LEFT,
    }),

    // ═══════════ Chú rể ═══════════
    text('sec-groom', {
      top: 4191.4, left: 14.9, width: 250.1, height: 52,
      text: 'About us', font: SCRIPT, size: 48, color: DEEP, z: 18, anim: IN_RIGHT,
    }),
    decor('sec-groom', {
      top: 4190.5, left: 38, width: 61.7, height: 49.4, img: SEED_KEYS.sparkle, z: 31, anim: MEDIA_RIGHT,
    }),
    photo('sec-groom', {
      top: 4286.6, left: 38, width: 306.1, height: 404, img: SEED_KEYS.groom, slot: 'groom', z: 31,
    }),
    box('sec-groom', {
      top: 4328.8, left: 319.9, width: 168.3, height: 320,
      fill: PAPER, border: [2, DEEP], z: 21, anim: MEDIA_LEFT,
    }),
    text('sec-groom', {
      top: 4363.7, left: 344, width: 143, height: 32,
      text: '{{groom.fullName}}', font: SCRIPT, size: 20, weight: '700', z: 23, anim: IN_LEFT,
    }),
    text('sec-groom', {
      top: 4408.7, left: 344, width: 143, height: 32,
      text: '{{groom.birthday}}', font: SCRIPT, size: 20, weight: '700', z: 24, anim: IN_LEFT,
    }),
    text('sec-groom', {
      top: 4465.6, left: 348, width: 139, height: 40,
      text: '{{groom.address}}', font: SCRIPT, size: 13, weight: '700', z: 25, anim: IN_LEFT,
    }),
    box('sec-groom', {
      top: 4782.7, left: 73.7, width: 370.4, height: 227.8,
      fill: PAPER, border: [1, DEEP], z: 27,
    }),
    photo('sec-groom', {
      top: 4759.7, left: 111.1, width: 367, height: 233.7, img: SEED_KEYS.album[1]!, slot: 'album2', z: 32,
    }),
    text('sec-groom', {
      top: 4815.1, left: -34.4, width: 172.1, height: 59,
      text: 'Groom', font: FORMAL, size: 36, weight: '400', color: BLUSH, spacing: 2,
      rotation: 270, z: 30, anim: IN_RIGHT,
    }),

    // ═══════════ Save the date ═══════════
    text('sec-date', {
      top: 5053.2, left: 142.8, width: 299.5, height: 35,
      text: 'Save the date', font: FORMAL, size: 46, weight: '400', color: DEEP, z: 33,
    }),
    decor('sec-date', {
      top: 5068, left: 126.5, width: 55, height: 44, img: SEED_KEYS.sparkle, z: 35,
    }),
    box('sec-date', {
      top: 5040.2, left: 436.1, width: 43, height: 140.5, fill: ROSE, z: 36, anim: MEDIA_LEFT,
    }),
    text('sec-date', {
      top: 5095.5, left: 391.6, width: 132, height: 30,
      text: '{{events.1.monthText}} / {{events.1.year}}',
      font: FORMAL, size: 22, weight: '400', color: '#ffffff', rotation: 90, z: 37, anim: IN_LEFT,
    }),
    box('sec-date', {
      top: 5112, left: 37.7, width: 461, height: 235.9, fill: PAPER, border: [1, DEEP], z: 28,
    }),
    photo('sec-date', {
      top: 5143.9, left: 57.3, width: 442.8, height: 670.2, img: SEED_KEYS.album[2]!, slot: 'album3', z: 34,
    }),
    // Thanh tiêu đề tháng: lịch nằm đè lên ảnh nên thiếu nó thì mấy con số trôi
    // lơ lửng, không ai đọc ra ngay đó là một tờ lịch.
    box('sec-date', {
      top: 5468, left: 171.1, width: 315.6, height: 40,
      fill: BLUSH, z: 38, anim: MEDIA_LEFT,
    }),
    text('sec-date', {
      top: 5468, left: 185, width: 200, height: 40,
      text: '{{events.1.monthText}}', font: FORMAL, size: 28, weight: '400',
      color: DEEP, align: 'left', z: 41, anim: IN_LEFT,
    }),
    box('sec-date', {
      top: 5510.7, left: 171.1, width: 315.6, height: 279.1,
      fill: PAPER, opacity: 0.37, border: [1, ROSE], z: 39,
    }),
    createNode('Calendar', 'sec-date', {
      top: 5509.2, left: 176.9, width: 311.1, height: 278.5, zIndex: 40,
      month: '{{events.1.datetime}}',
      // Đánh dấu cả hai buổi. Ngày nào rơi ngoài tháng đang vẽ thì `CalendarNode`
      // tự lọc bỏ, nên hai buổi khác tháng cũng không làm vỡ lưới.
      markedDates: ['{{events.0.datetime}}', '{{events.1.datetime}}'],
      markerIcon: SEED_KEYS.heart,
      themeColor: ROSE, color: INK,
      // Chữ số giữ font serif chứ không dùng font thư pháp như tiêu đề: một
      // lưới 7 cột toàn số viết tay là thứ không ai dò ra ngày cưới nằm đâu.
      fontFamily: SERIF, fontSize: 14,
      weekStartsOn: 1, showLunar: false,
      ...fx('slide-up', 0.3),
    }),

    // ═══════════ Trình tự buổi lễ ═══════════
    box('sec-timeline', {
      top: 5869.7, left: 232, width: 1.5, height: 193, fill: RULE, anim: MEDIA_UP,
    }),
    ...timelineRow('sec-timeline', 5866, SEED_KEYS.champagne, 38.3,
      '{{events.0.dayMonth}} &nbsp;·&nbsp; {{events.0.time}}<br>Khai tiệc — Lễ vu quy', 42),
    ...timelineRow('sec-timeline', 5936.7, SEED_KEYS.car, 41,
      '{{events.2.dayMonth}} &nbsp;·&nbsp; {{events.2.time}}<br>Lễ rước dâu', 45),
    ...timelineRow('sec-timeline', 6010, SEED_KEYS.handsHeart, 31.8,
      '{{events.1.dayMonth}} &nbsp;·&nbsp; {{events.1.time}}<br>Khai tiệc — Lễ thành hôn', 48),

    // ═══════════ Xác nhận tham dự ═══════════
    photo('sec-rsvp', {
      top: 6101, left: 0, width: 498.7, height: 911, img: SEED_KEYS.cover, slot: 'cover', z: 49,
    }),
    box('sec-rsvp', {
      top: 6132, left: 37.5, width: 417.8, height: 685.3, fill: '#ffffff', opacity: 0.43, z: 50,
    }),
    text('sec-rsvp', {
      top: 6103.3, left: 14.9, width: 482.6, height: 61,
      text: 'INVITATION', font: SYS, size: 19, color: '#ffffff', spacing: 30, z: 51,
    }),
    photo('sec-rsvp', {
      top: 6160, left: 79.6, width: 340.9, height: 225, img: SEED_KEYS.album[0]!, slot: 'album1', z: 54,
    }),
    text('sec-rsvp', {
      top: 6326.6, left: -172.5, width: 460, height: 56,
      text: 'I love you forever', font: SCRIPT, size: 40, color: DEEP, spacing: 4,
      rotation: 90, z: 56, anim: STILL,
    }),
    photo('sec-rsvp', {
      top: 6402.9, left: 79.6, width: 340.9, height: 184.1, img: SEED_KEYS.album[3]!, slot: 'album4', z: 52,
    }),
    text('sec-rsvp', {
      top: 6541.6, left: 216.6, width: 460, height: 56,
      text: 'Nice to meet you', font: SCRIPT, size: 40, color: DEEP, spacing: 4,
      rotation: 90, z: 57, anim: STILL,
    }),
    photo('sec-rsvp', {
      top: 6600, left: 82.3, width: 338.1, height: 182.6, img: SEED_KEYS.album[2]!, slot: 'album3', z: 53,
    }),
    createNode('RsvpForm', 'sec-rsvp', {
      top: 6871.1, left: 104.5, width: 300, height: 366, zIndex: 55,
      titleText: 'Xác nhận tham dự',
      nameLabel: 'Họ và tên',
      attendLabel: 'Bạn sẽ tham dự chứ?',
      attendYesText: 'Có, tôi sẽ tham dự',
      attendNoText: 'Tôi bận, rất tiếc không thể tham dự',
      enableAttendeeCount: true,
      attendeeCountLabel: 'Số lượng người tham dự',
      enableGuestSide: false,
      enableTransportation: false,
      enableMessage: false,
      submitText: 'Gửi xác nhận',
      successText: 'Cảm ơn bạn! Hẹn gặp trong ngày vui.',
      color: '#333333', buttonColor: ROSE, buttonTextColor: '#ffffff',
      fontFamily: SANS, fontSize: 14,
      backgroundColor: '#ffffff',
      padding: [16, 16, 16, 16],
      ...fx('fade', 0),
    }),

    // ═══════════ Mừng cưới ═══════════
    text('sec-gift', {
      top: 7368.4, left: 29.6, width: 449, height: 99,
      text:
        'Mình rất muốn được chụp chung với bạn những tấm hình kỷ niệm vì vậy ' +
        'hãy đến sớm hơn một chút bạn yêu nhé! Đám cưới của chúng mình sẽ trọn ' +
        'vẹn hơn khi có thêm lời chúc phúc và sự hiện diện của các bạn',
      font: SANS, size: 15, color: '#000000', lineHeight: '1.65', spacing: 1, z: 61, anim: STILL,
    }),
    text('sec-gift', {
      top: 7520.9, left: 91.1, width: 315.6, height: 31,
      text: 'Gửi quà mừng', font: SYS, size: 26, color: ROSE, upper: true, z: 59, anim: STILL,
    }),
    ...giftCard('sec-gift', 7616.8, 'left', {
      role: 'Cô dâu',
      nameToken: '{{bride.fullName}}',
      accountToken: '{{accounts.1.bank}} {{accounts.1.accountNumber}}',
      photoKey: SEED_KEYS.bride, photoSlot: 'bride',
      qrSlot: 'qrBride',
      z: 62,
    }),
    ...giftCard('sec-gift', 7857.2, 'right', {
      role: 'Chú rể',
      nameToken: '{{groom.fullName}}',
      accountToken: '{{accounts.0.bank}} {{accounts.0.accountNumber}}',
      photoKey: SEED_KEYS.groom, photoSlot: 'groom',
      qrSlot: 'qrGroom',
      z: 63,
    }),

    // ═══════════ Cảm ơn ═══════════
    decor('sec-thanks', {
      top: 8077.4, left: 176.5, width: 172.2, height: 172.2, img: SEED_KEYS.coupleFigure,
      z: 72, anim: STILL,
    }),
    text('sec-thanks', {
      top: 8210.4, left: 43.9, width: 404.9, height: 130,
      text: 'Thank you', font: FORMAL, size: 100, weight: '400', color: DEEP, z: 71, anim: STILL,
    }),
  ];

  for (const node of nodes) {
    if (SHIFTED_SECTIONS.has(node.sectionId)) node.props.top += EVENT_GROWTH;
    doc.nodes[node.id] = node;
    doc.order.push(node.id);
  }

  assertNodesInSections(doc);
  return doc;
}

/**
 * Node phải bắt đầu bên trong section của nó.
 *
 * Chỉ kiểm mép trên, KHÔNG kiểm mép dưới: mẫu này cố tình để ảnh và khối màu
 * tràn xuống section sau (ảnh "Save the date" cao 670px vắt qua hai section).
 * Nền trong suốt nên tràn không sao — nhưng bắt đầu *trước* section thì node
 * chỉ mount khi đã cuộn qua mất nó, và animation vào sẽ không bao giờ chạy.
 */
function assertNodesInSections(doc: TemplateDoc): void {
  const byId = new Map(doc.sections.map((s) => [s.id, s]));
  const problems: string[] = [];

  for (const node of Object.values(doc.nodes)) {
    const section = byId.get(node.sectionId);
    if (!section) {
      problems.push(`${node.name} trỏ tới section không có: ${node.sectionId}`);
      continue;
    }
    const { top } = node.props;
    const limit = section.top + section.height;
    if (top < section.top || top >= limit) {
      problems.push(
        `${node.name} (top ${top}) không bắt đầu trong section "${section.name}" [${section.top}, ${limit})`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Mẫu "Ngọt ngào" có node lệch section:\n  - ${problems.join('\n  - ')}`);
  }
}
