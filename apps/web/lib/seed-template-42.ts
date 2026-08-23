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

const CREAM = '#fefcfb';   // nền toàn thiệp — trắng ngà, không trắng tinh
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

// ─────────────────────────── Biến thể ───────────────────────────

/**
 * Đám cưới thường có hai buổi ở hai nhà: lễ vu quy bên nhà gái, lễ thành hôn
 * bên nhà trai. Khách hai bên không đi cùng một buổi, nên một tấm thiệp in cả
 * hai là bắt người nhận tự đoán buổi nào dành cho mình — và tấm thiệp thì dài
 * gấp đôi phần họ cần đọc.
 *
 *   'full'      — một tấm in cả hai buổi (khách chung, hoặc đám cưới gộp)
 *   'vu-quy'    — chỉ buổi nhà gái
 *   'thanh-hon' — chỉ buổi nhà trai
 *
 * Cùng một bản vẽ; khác đúng những chỗ có nhắc tới buổi lễ: khối tiệc, trình
 * tự, đếm ngược, lịch, tháng trên "Save the date" và ba chữ ở lề phần "Lễ …".
 */
export type SweetVariant = 'full' | 'vu-quy' | 'thanh-hon';

// ─────────────────────────── Section ───────────────────────────

/**
 * Mốc dọc GỐC: bố cục một khối tiệc, ba mốc trình tự.
 *
 * Toạ độ của gần một trăm node bên dưới viết theo đúng bảng này. Biến thể nào
 * cần section cao hơn hay thấp hơn thì khai trong `GROWTH`, và node của mọi
 * section phía sau được đẩy một lượt lúc dựng doc — thay vì sửa tay từng con
 * số, việc mà sai một chỗ là lệch cả nửa tấm thiệp.
 */
const Y_BASE = {
  cover: 0,
  intro: 720,
  vows: 1420,
  event: 1900,
  sweet: 2560,
  bride: 3400,
  groom: 4180,
  date: 5000,
  timeline: 5820,
  rsvp: 6090,
  gift: 7300,
  thanks: 8000,
  end: 8382,
} as const;

type SectionKey = Exclude<keyof typeof Y_BASE, 'end'>;

const SECTION_ORDER: SectionKey[] = [
  'cover', 'intro', 'vows', 'event', 'sweet', 'bride',
  'groom', 'date', 'timeline', 'rsvp', 'gift', 'thanks',
];

/** Tên section hiện trong editor. `vows` đổi theo biến thể nên để trống ở đây. */
const SECTION_NAME: Record<SectionKey, string> = {
  cover: 'Bì thư', intro: 'Lời mời', vows: '', event: 'Tiệc cưới',
  sweet: 'Sweet wedding', bride: 'Cô dâu', groom: 'Chú rể', date: 'Save the date',
  timeline: 'Trình tự', rsvp: 'Xác nhận', gift: 'Mừng cưới', thanks: 'Cảm ơn',
};

/** Hai cột "Nhà Trai" / "Nhà Gái" ở phần "Lễ …" — đối xứng quanh trục giữa */
const VOWS_W = 226;
const VOWS_L = 10;
const VOWS_R = 500 - VOWS_W - VOWS_L;

/** Khoảng cách dọc giữa hai khối tiệc trên bản in cả hai buổi */
const PARTY_GAP = 600;

/** Cao độ một khối tiệc, tính từ `top` xuống hết mép dưới khung bản đồ */
const PARTY_HEIGHT = 544;

/**
 * Chiều cao dôi ra so với `Y_BASE`, theo từng section.
 *
 * Thiệp gộp cõng hai khối tiệc nên phần "Tiệc cưới" phải dài thêm một khối;
 * thiệp tách chỉ còn một khối nên ngắn lại, và phần "Trình tự" cũng bớt một mốc.
 *
 * Con số tính từ `PARTY_GAP`/`PARTY_HEIGHT` chứ không gõ tay: bản đồ dời xuống
 * dưới làm khối tiệc cao thêm hơn 200px, và một hằng số 140 gõ cứng ở đây sẽ
 * lặng lẽ để khối tiệc đè lên phần "Sweet wedding".
 */
const EVENT_BASE = Y_BASE.sweet - Y_BASE.event;
/** Mép trên khối tiệc đầu tiên, tính từ đầu section */
const PARTY_INSET = 4.2;
/** Chỗ trống dưới khối tiệc cuối trước khi sang section sau */
const PARTY_TAIL = 48;

const eventHeight = (blocks: number) =>
  PARTY_INSET + (blocks - 1) * PARTY_GAP + PARTY_HEIGHT + PARTY_TAIL - EVENT_BASE;

const GROWTH: Record<SweetVariant, Partial<Record<SectionKey, number>>> = {
  'full': { event: eventHeight(2) },
  'vu-quy': { event: eventHeight(1), timeline: -70 },
  'thanh-hon': { event: eventHeight(1), timeline: -70 },
};

interface Layout {
  /** Độ đẩy xuống của một section = tổng phần dôi ra của mọi section đứng trước */
  shift: Record<SectionKey, number>;
  height: Record<SectionKey, number>;
  canvasHeight: number;
}

function layoutOf(variant: SweetVariant): Layout {
  const growth = GROWTH[variant];
  const shift = {} as Record<SectionKey, number>;
  const height = {} as Record<SectionKey, number>;
  let acc = 0;

  SECTION_ORDER.forEach((key, i) => {
    const next = SECTION_ORDER[i + 1];
    shift[key] = acc;
    height[key] = (next ? Y_BASE[next] : Y_BASE.end) - Y_BASE[key] + (growth[key] ?? 0);
    acc += growth[key] ?? 0;
  });

  return { shift, height, canvasHeight: Y_BASE.end + acc };
}

/** 'sec-timeline' → 'timeline' */
function keyOf(sectionId: string): SectionKey {
  return sectionId.slice('sec-'.length) as SectionKey;
}

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
  /** Kính mờ: làm nhoè ảnh nằm sau tấm nền, px */
  frost?: number;
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
    backdropBlur: o.frost ?? 0,
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
  /** Làm mờ ảnh nền, px — dành cho ảnh nằm dưới chữ */
  blur?: number;
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
    blur: o.blur ?? 0,
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
 * Một khối tiệc: tiêu đề, giờ, khối ngày lớn, âm lịch, nơi tổ chức, rồi bản đồ
 * nằm dưới cùng — tất cả canh giữa.
 *
 * Bản trước nép bản đồ 132px vào một góc và dồn chữ sang nửa còn lại, hai khối
 * thì đổi bên: cách đó chỉ có lý khi một tấm thiệp cõng hai buổi tiệc và cần
 * mắt phân biệt được ngay là có hai. Thiệp đã tách thì mỗi tấm chỉ còn một
 * khối, nên sự lệch đó không còn nói lên điều gì — chỉ còn một cột chữ dạt
 * sang bên và một tấm bản đồ bé đến mức không tra được đường.
 */
function partyBlock(section: string, top: number, ev: string, z: number) {
  return [
    text(section, {
      top, left: 25.5, width: 448, height: 53,
      text: `{{${ev}.title}}`, font: SERIF, size: 31, weight: '700', upper: true, z,
    }),
    text(section, {
      top: top + 45, left: 25.5, width: 448, height: 43,
      text: `Vào lúc {{${ev}.time}} {{${ev}.weekday}}`,
      font: SERIF, size: 25, weight: '700', upper: true, z,
    }),
    hrule(section, top + 92, 17.3, 169.7),
    hrule(section, top + 92, 306, 180.5),
    text(section, {
      top: top + 99, left: 17.3, width: 169.7, height: 46,
      text: `{{${ev}.monthText}}`, font: SERIF, size: 33, weight: '700', upper: true, z, anim: IN_RIGHT,
    }),
    text(section, {
      top: top + 99, left: 306, width: 180.5, height: 46,
      text: `Năm {{${ev}.year}}`, font: SERIF, size: 33, weight: '700', upper: true, z, anim: IN_LEFT,
    }),
    text(section, {
      top: top + 79, left: 142.8, width: 205, height: 106,
      text: `{{${ev}.day}}`, font: SERIF, size: 94, weight: '700', color: DEEP, z,
    }),
    hrule(section, top + 152, 17.3, 169.7),
    hrule(section, top + 152, 306, 180.5),
    text(section, {
      top: top + 188, left: 32.3, width: 448, height: 40,
      text: `({{${ev}.lunarText}})`, font: SERIF, size: 22, weight: '400', z,
    }),

    text(section, {
      top: top + 232, left: 25.5, width: 448, height: 40,
      text: `{{${ev}.venue}}`, font: SERIF, size: 22, weight: '700', upper: true, z,
    }),
    text(section, {
      top: top + 276, left: 25.5, width: 448, height: 58,
      text: `{{${ev}.address}}`, font: SANS, size: 16, lineHeight: '1.55', z,
    }),

    // Bản đồ dưới cùng, gần hết bề ngang, vẫn giữ khung trắng mảnh như một tấm
    // ảnh dán vào thiệp. Khung 284 canh giữa canvas 500 → lề 108 mỗi bên.
    box(section, {
      top: top + 352, left: 108, width: 284, height: 192, fill: '#ffffff', z,
      anim: MEDIA_UP,
    }),
    createNode('Map', section, {
      top: top + 356, left: 112, width: 276, height: 184, zIndex: z + 1,
      mode: 'embed',
      label: `Bản đồ tới {{${ev}.venue}}`,
      query: `{{${ev}.venue}} {{${ev}.address}}`,
      fontFamily: SANS, fontSize: 12,
      ...fx('slide-up', 0.3),
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
    top, width, height: 70, text: word, font: FORMAL, size: 64,
    weight: '400' as const, anim: IN_LEFT,
  };
  return [
    text(section, { ...common, left: left + 1.6, color: shadowColor, z }),
    text(section, { ...common, left, color: '#ffffff', z: z + 1 }),
  ];
}

/** Khoảng cách dọc giữa hai mốc trong trình tự */
const TIMELINE_GAP = 72;

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
      text: label, font: SERIF, size: 20, color: '#000000', align: 'left',
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
  opts: { role: string; nameToken: string; accountToken: string; photoKey: string; photoSlot: string; accountIndex: number; z: number },
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
    /**
     * Nút "Gửi quà" thay cho tấm QR dán sẵn trên thẻ.
     *
     * Bản trước in thẳng mã QR lên thẻ, cỡ 102px. Ở cỡ đó máy quét của khách
     * phải rà rất gần mới bắt được, mà chỗ đó lại là chỗ chật nhất của thẻ. Bấm
     * ra một lớp phủ thì QR hiện ở 200px, kèm tên ngân hàng và một nút chép số
     * tài khoản — thứ mà một tấm ảnh QR không làm được.
     *
     * `accountIndex` để mỗi nút chỉ mở tài khoản của đúng người trên thẻ đó.
     * Chưa nhập tài khoản thì lớp phủ nói rõ là sẽ cập nhật, chứ nút không biến
     * mất: khách vừa bấm mà nút bay đi thì tưởng thiệp hỏng.
     */
    createNode('GiftQr', section, {
      top: top + 55, left: qrLeft, width: 102.3, height: 44, zIndex: z + 16,
      label: 'Gửi quà',
      fontFamily: FORMAL, fontSize: 24, color: '#ffffff',
      backgroundColor: ROSE,
      borderRadius: [22, 22, 22, 22],
      modalTitle: `Gửi quà mừng ${opts.role.toLowerCase()}`,
      accountIndex: opts.accountIndex,
      hasShadow: true,
      boxShadow: { offsetX: 0, offsetY: 3, blur: 10, spread: 0, color: 'rgba(139, 47, 48, 0.28)' },
      // Không nhấp nháy: nút nằm trên một tấm thẻ đã có ảnh tròn và vòng nét
      // đứt, thêm một thứ động đậy nữa là chỗ đó thành ồn.
      continuousAnimation: { type: 'none', duration: 2, delay: 0 },
      ...STILL,
    }),
    text(section, {
      top: top + 22, left: textMid - 75, width: 150, height: 30,
      text: opts.role, font: FORMAL, size: 28, weight: '400', color: INK, z: z + 3, anim: STILL,
    }),
    text(section, {
      // 21px chứ không 24: cột chữ chỉ rộng 170px (thẻ 278 trừ chỗ mã QR), mà
      // họ tên đầy đủ tiếng Việt ở nét thư pháp 24px là vừa đủ tràn sang dòng hai.
      top: top + 55, left: textMid - 85, width: 170, height: 32,
      text: opts.nameToken, font: FORMAL, size: 21, weight: '400', color: INK, z: z + 4, anim: STILL,
    }),
    // Số tài khoản giữ font sans: đây là dãy số người ta phải đọc để chuyển
    // khoản, chữ số viết tay là mời nhập nhầm một con số.
    text(section, {
      top: top + 94, left: textMid - 80, width: 160, height: 20,
      text: opts.accountToken, size: 14, color: INK, z: z + 5, anim: STILL,
    }),
  ];
}

// ─────────────────────────── Nội dung theo biến thể ───────────────────────────

/**
 * Một mốc trong trình tự buổi lễ.
 *
 * `ev` là thứ tự sự kiện mà mẫu này quy ước với dữ liệu thiệp:
 *   events.0 = tiệc vu quy (nhà gái)
 *   events.1 = tiệc thành hôn (nhà trai)
 *   events.2 = lễ rước dâu
 */
interface TimelineStop {
  ev: string;
  img: string;
  size: number;
  label: string;
}

const VU_QUY: TimelineStop = {
  ev: 'events.0', img: SEED_KEYS.champagne, size: 38.3, label: 'Khai tiệc — Lễ vu quy',
};
const RUOC_DAU: TimelineStop = {
  ev: 'events.2', img: SEED_KEYS.car, size: 41, label: 'Lễ rước dâu',
};
const THANH_HON: TimelineStop = {
  ev: 'events.1', img: SEED_KEYS.handsHeart, size: 31.8, label: 'Khai tiệc — Lễ thành hôn',
};

interface VariantSpec {
  id: string;
  name: string;
  slug: string;
  /** Ba chữ xếp dọc ở lề trái phần "Lễ …" */
  ceremony: [string, string, string];
  /** Tên section `vows` trong editor */
  sectionName: string;
  /** Khối tiệc in trên thiệp — một hoặc hai */
  parties: string[];
  /** Buổi chính: đếm ngược, tháng trên "Save the date", tháng mà lịch mở tới */
  main: string;
  /**
   * Thiệp tách vẫn giữ lễ rước dâu: đó là mốc nối hai nhà, và là lúc khách bên
   * kia biết đoàn đón dâu tới hay đi. Bỏ nó đi thì mỗi tấm chỉ còn đúng một
   * dòng, không còn ra một trình tự nữa.
   */
  stops: TimelineStop[];
}

const VARIANTS: Record<SweetVariant, VariantSpec> = {
  'full': {
    id: 'tpl-ngot-ngao', name: 'Ngọt ngào', slug: 'ngot-ngao',
    ceremony: ['Lễ', 'Thành', 'Hôn'], sectionName: 'Lễ thành hôn',
    parties: ['events.0', 'events.1'], main: 'events.1',
    stops: [VU_QUY, RUOC_DAU, THANH_HON],
  },
  'vu-quy': {
    id: 'tpl-ngot-ngao-vu-quy', name: 'Ngọt ngào — Vu quy', slug: 'ngot-ngao-vu-quy',
    ceremony: ['Lễ', 'Vu', 'Quy'], sectionName: 'Lễ vu quy',
    parties: ['events.0'], main: 'events.0',
    stops: [VU_QUY, RUOC_DAU],
  },
  'thanh-hon': {
    id: 'tpl-ngot-ngao-thanh-hon', name: 'Ngọt ngào — Thành hôn', slug: 'ngot-ngao-thanh-hon',
    ceremony: ['Lễ', 'Thành', 'Hôn'], sectionName: 'Lễ thành hôn',
    parties: ['events.1'], main: 'events.1',
    stops: [RUOC_DAU, THANH_HON],
  },
};

// ─────────────────────────── Mẫu ───────────────────────────

export function sweetTemplate(variant: SweetVariant = 'full'): TemplateDoc {
  const v = VARIANTS[variant];
  const layout = layoutOf(variant);
  const doc = createEmptyDoc(v.id, v.name, v.slug);

  doc.canvas.height = layout.canvasHeight;
  doc.canvas.background = CREAM;

  /**
   * Section ở mẫu này KHÔNG có nền. Nền là của canvas, một màu chạy suốt 8382px.
   * Nhờ vậy node được phép vắt qua ranh giới section — mà mẫu này thì đầy node
   * như vậy — mà không bị nền của section kế tiếp vẽ đè lên.
   */
  doc.sections = SECTION_ORDER.map((key) => ({
    id: `sec-${key}`,
    name: key === 'vows' ? v.sectionName : SECTION_NAME[key],
    top: Y_BASE[key] + layout.shift[key],
    height: layout.height[key],
    background: null,
  }));

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
      text: 'WEDDING INVITATION', font: SYS, size: 21, color: BRICK, spacing: 9,
    }),
    text('sec-cover', {
      top: 53.9, left: 10, width: 480, height: 34,
      text: 'Thiệp mời cưới', font: SYS, size: 31, color: BRICK, spacing: 2, upper: true,
    }),
    /**
     * Chú rể đứng trước cô dâu, đúng thứ tự vẫn đọc trên thiệp cưới Việt — và
     * cũng là thứ tự của khối "Lễ …" ngay bên dưới, nên hai chỗ không đá nhau.
     *
     * Ô rộng 206 ở cỡ 38 chứ không 177 ở cỡ 43: `shortName` không phải lúc nào
     * cũng là một tiếng. "Nguyễn Thủy" ở Great Vibes 43px đo được 213px, tràn
     * ô cũ rồi rơi xuống dòng hai — mà chữ canh giữa theo chiều dọc nên dòng
     * thừa dâng ngược lên đè vào "THIỆP MỜI CƯỚI". Ở cỡ 38 nó còn 188px, và
     * ngay cả khi có tên dài hơn phải xuống dòng thì hai dòng vẫn nằm lọt giữa
     * dòng tiêu đề và dấu song hỷ.
     */
    text('sec-cover', {
      top: 114, left: 10, width: 206, height: 54,
      text: '{{groom.shortName}}', font: FORMAL, size: 38, weight: '400', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-cover', {
      top: 114, left: 284, width: 206, height: 54,
      text: '{{bride.shortName}}', font: FORMAL, size: 38, weight: '400', color: '#000000', anim: IN_LEFT,
    }),
    text('sec-cover', {
      top: 118.5, left: 216, width: 68, height: 54,
      text: '&amp;', font: FORMAL, size: 42, weight: '400', color: BRICK,
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
      // Nhịp mở giờ dài hơn (dấu xi bong ra trước rồi nắp mới lật, xem
      // runtime/nodes/envelope.tsx). 3.4s là bì tan biến khi thư còn đang trồi.
      dismissAfter: 4.4,
      ...fx('slide-up', 0.3),
    }),
    text('sec-cover', {
      top: 630.4, left: 110.6, width: 282.5, height: 45,
      text: 'Chạm để mở thiệp', font: SCRIPT, size: 30, color: DEEP, z: 80,
      anim: fx('slide-up', 0.4, 1.6),
    }),

    // ═══════════ Lời mời ═══════════
    photo('sec-intro', {
      top: 720, left: 2, width: 495, height: 697, img: SEED_KEYS.cover, slot: 'cover',
    }),
    box('sec-intro', {
      // Alpha nằm trong chính màu nền, không mượn `opacity` của node: opacity
      // làm mờ cả tấm nền lẫn mọi thứ vẽ trong nó, và từng bị hiệu ứng xuất
      // hiện xoá mất (xem animation.ts). Có alpha thì `frost` mới thấy tác
      // dụng — làm nhoè bao nhiêu cũng vô nghĩa sau một lớp trắng đặc.
      top: 1040, left: 31.9, width: 448.4, height: 372,
      fill: 'rgba(255, 255, 255, 0.34)', frost: 26,
    }),
    createNode('CountDown', 'sec-intro', {
      top: 1025.9, left: 108.5, width: 310, height: 65,
      targetDate: `{{${v.main}.datetime}}`,
      themeColor: COUNTDOWN, color: '#ffffff',
      fontFamily: SYS, fontSize: 18, spacing: 8,
      expiredText: 'Chúng mình đã về chung một nhà',
      ...fx('slide-up', 0.3),
    }),
    text('sec-intro', {
      top: 1098, left: 38.3, width: 442, height: 34,
      text: 'INVITATION', font: SYS, size: 31, color: DEEP, spacing: 11,
    }),
    text('sec-intro', {
      top: 1150, left: 40, width: 420, height: 250,
      text:
        'Gửi đến gia đình và bạn bè thân mến,<br>' +
        'Cảm ơn bạn đã dành thời gian quý báu để cùng chúng mình chung vui ' +
        'trong ngày đặc biệt này. Chúng mình vô cùng biết ơn vì luôn có sự ' +
        'đồng hành và ủng hộ của bạn, và thật vinh hạnh khi được chia sẻ ' +
        'niềm hạnh phúc của chúng mình cùng bạn.<br>' +
        'Trân trọng kính mời bạn đến dự lễ cưới của chúng mình',
      font: SCRIPT, size: 21, weight: '700', color: DEEP, lineHeight: '1.4',
    }),

    // ═══════════ Lễ thành hôn ═══════════
    vrule('sec-vows', 1425.5, 52, 74),
    text('sec-vows', {
      top: 1491, left: 100.8, width: 248.5, height: 34,
      text: '{{groom.fullName}}', font: SCRIPT, size: 34, weight: '700', color: DEEP,
    }),
    text('sec-vows', {
      top: 1509, left: 8, width: 90, height: 31,
      text: v.ceremony[0], font: SCRIPT, size: 31, weight: '700', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1543.8, left: 153, width: 206.5, height: 49,
      text: '&amp;', font: SCRIPT, size: 42, weight: '700', color: DEEP,
    }),
    text('sec-vows', {
      top: 1551.9, left: 8, width: 90, height: 33,
      text: v.ceremony[1], font: SCRIPT, size: 31, weight: '700', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1598, left: 8, width: 90, height: 33,
      text: v.ceremony[2], font: SCRIPT, size: 31, weight: '700', color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1607.4, left: 231.5, width: 248.5, height: 48,
      text: '{{bride.fullName}}', font: SCRIPT, size: 34, weight: '700', color: DEEP, anim: IN_LEFT,
    }),
    vrule('sec-vows', 1656, 52, 67),

    /**
     * Hai cột đối xứng quanh trục giữa, cùng bề rộng, cùng lề.
     *
     * Cột trái trước đây bắt đầu ở x=-18: chữ canh giữa nên tên ngắn thì không
     * ai thấy gì, tới khi gặp một địa chỉ đủ dài thì ký tự đầu bị cắt cụt ngoài
     * mép thiệp ("131 Giải Phóng" hiện ra thành "31 Giải Phóng"). Cột phải thì
     * chạy sát tận x=500. Giờ cả hai nằm trong khoảng [10, 490] với khe giữa
     * 28px, nên dài đến mấy cũng chỉ xuống dòng chứ không tràn ra ngoài.
     */
    text('sec-vows', {
      top: 1729.9, left: VOWS_L, width: VOWS_W, height: 31,
      text: 'Nhà Trai', font: SERIF, size: 27, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1773.2, left: VOWS_L, width: VOWS_W, height: 31,
      text: 'Ông: {{groom.father}}', font: SANS, size: 18, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1804, left: VOWS_L, width: VOWS_W, height: 26,
      text: 'Bà: {{groom.mother}}', font: SANS, size: 18, color: '#000000', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1836, left: VOWS_L, width: VOWS_W, height: 56,
      text: '{{groom.address|lines}}', font: SANS, size: 18, color: '#000000',
      lineHeight: '1.35', anim: IN_RIGHT,
    }),
    text('sec-vows', {
      top: 1729.9, left: VOWS_R, width: VOWS_W, height: 31,
      text: 'Nhà Gái', font: SERIF, size: 27, color: '#000000', anim: IN_LEFT,
    }),
    text('sec-vows', {
      top: 1773.2, left: VOWS_R, width: VOWS_W, height: 31,
      text: 'Ông: {{bride.father}}', font: SANS, size: 18, color: '#000000', anim: IN_LEFT,
    }),
    text('sec-vows', {
      top: 1804, left: VOWS_R, width: VOWS_W, height: 26,
      text: 'Bà: {{bride.mother}}', font: SANS, size: 18, color: '#000000', anim: IN_LEFT,
    }),
    text('sec-vows', {
      top: 1836, left: VOWS_R, width: VOWS_W, height: 56,
      text: '{{bride.address|lines}}', font: SANS, size: 18, color: '#000000',
      lineHeight: '1.35', anim: IN_LEFT,
    }),

    // ═══════════ Tiệc cưới ═══════════
    // Tiêu đề lấy từ chính sự kiện, không đóng cứng: mỗi đám cưới gọi tên hai
    // buổi tiệc một kiểu, và mẫu không nên áp đặt cách gọi của một nhà nào.
    //
    ...v.parties.flatMap((ev, i) => partyBlock('sec-event', 1904.2 + i * PARTY_GAP, ev, i * 2)),

    // ═══════════ Sweet wedding ═══════════
    box('sec-sweet', {
      top: 2608.5, left: 256.3, width: 242.3, height: 866.7, fill: BLUSH, z: 2, anim: MEDIA_LEFT,
    }),
    decor('sec-sweet', {
      top: 2577.7, left: 22.5, width: 70.1, height: 56.1, img: SEED_KEYS.sparkle, z: 4, anim: MEDIA_RIGHT,
    }),
    box('sec-sweet', {
      top: 2681.1, left: 150, width: 338, height: 334,
      fill: BLUSH, opacity: 0.15, border: [4, BRICK], z: 5,
    }),
    photo('sec-sweet', {
      top: 2695.3, left: 166, width: 306, height: 306, img: SEED_KEYS.album[0]!, slot: 'album1', z: 6,
    }),
    text('sec-sweet', {
      top: 2608.5, left: 24.4, width: 463.8, height: 53,
      text: 'SWEET WEDDING', font: SYS, size: 27, color: BRICK, spacing: 16, z: 7,
    }),
    /**
     * Mốc phải né là **khung viền** ở x=150, không phải mép ảnh.
     *
     * "Marry" ở Great Vibes 48px rộng 124px, canh trái từ x=8 nên chạm 132 —
     * còn 18px hở, đủ cho cái đuôi chữ "y" vươn ra ngoài bề rộng danh nghĩa
     * của nét chữ. Font thư pháp luôn vẽ tràn khỏi ô của nó, nên chừa lề chứ
     * đừng canh sát mép.
     */
    text('sec-sweet', {
      top: 2740, left: 8, width: 160, height: 64,
      text: 'Marry', font: FORMAL, size: 48, weight: '400', color: BRICK,
      align: 'left', z: 8, anim: IN_RIGHT,
    }),
    text('sec-sweet', {
      top: 2818, left: 34, width: 140, height: 64,
      text: 'me?', font: FORMAL, size: 48, weight: '400', color: BRICK,
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
      text: 'About us', font: SCRIPT, size: 53, color: DEEP, z: 17,
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
    /**
     * Cột chữ chỉ được rộng bằng PHẦN THẺ CÒN NHÌN THẤY, không bằng cả thẻ.
     *
     * Tấm ảnh cô dâu bắt đầu ở x=192.3 và đè lên mép phải của thẻ; cột chữ cũ
     * rộng tới 202 nên một địa chỉ vừa đủ dài ("Xã Đắk Liêng, Đắk Lắk" đo được
     * 155px ở cỡ 17) vẫn nằm gọn một dòng rồi chạy thẳng vào tấm ảnh. Thu về
     * 134px thì dòng đó tự ngắt làm hai trước khi chạm ảnh — và địa chỉ dài hơn
     * cũng thế, thay vì chỉ chữa đúng một cái tên xã.
     */
    text('sec-bride', {
      top: 3566, left: 48, width: 134, height: 34,
      text: '{{bride.fullName}}', font: SCRIPT, size: 20, weight: '700', z: 22, anim: IN_RIGHT,
    }),
    text('sec-bride', {
      top: 3604, left: 48, width: 134, height: 34,
      text: '{{bride.birthday}}', font: SCRIPT, size: 20, weight: '700', z: 23, anim: IN_RIGHT,
    }),
    text('sec-bride', {
      top: 3652, left: 48, width: 134, height: 72,
      text: '{{bride.address|lines}}', font: SCRIPT, size: 17, weight: '700',
      lineHeight: '1.35', z: 24, anim: IN_RIGHT,
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
      text: 'Bride', font: FORMAL, size: 40, weight: '400', color: BLUSH, spacing: 2,
      rotation: 90, z: 29, anim: IN_LEFT,
    }),

    // ═══════════ Chú rể ═══════════
    text('sec-groom', {
      top: 4191.4, left: 14.9, width: 250.1, height: 52,
      text: 'About us', font: SCRIPT, size: 53, color: DEEP, z: 18, anim: IN_RIGHT,
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
    // Thẻ chú rể là bản soi gương: ảnh đè lên mép TRÁI của thẻ (tới x=344.1),
    // và nằm TRÊN chữ, nên cột chữ tràn sang bên đó thì mất hẳn chứ không chỉ
    // chạm ảnh như bên cô dâu. Cùng bề rộng 134 để hai thẻ ngắt dòng như nhau.
    text('sec-groom', {
      top: 4360, left: 350, width: 134, height: 34,
      text: '{{groom.fullName}}', font: SCRIPT, size: 20, weight: '700', z: 23, anim: IN_LEFT,
    }),
    text('sec-groom', {
      top: 4406, left: 350, width: 134, height: 34,
      text: '{{groom.birthday}}', font: SCRIPT, size: 20, weight: '700', z: 24, anim: IN_LEFT,
    }),
    text('sec-groom', {
      top: 4458, left: 350, width: 134, height: 72,
      text: '{{groom.address|lines}}', font: SCRIPT, size: 17, weight: '700',
      lineHeight: '1.35', z: 25, anim: IN_LEFT,
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
      text: 'Groom', font: FORMAL, size: 40, weight: '400', color: BLUSH, spacing: 2,
      rotation: 270, z: 30, anim: IN_RIGHT,
    }),

    // ═══════════ Save the date ═══════════
    text('sec-date', {
      top: 5053.2, left: 142.8, width: 299.5, height: 35,
      text: 'Save the date', font: FORMAL, size: 51, weight: '400', color: DEEP, z: 33,
    }),
    decor('sec-date', {
      top: 5068, left: 126.5, width: 55, height: 44, img: SEED_KEYS.sparkle, z: 35,
    }),
    /**
     * Thanh hồng ở mép phải giờ là hoạ tiết thuần, không cõng chữ nữa.
     *
     * Trước đây nó chứa "{{monthText}} / {{year}}" xoay 90°. Thanh rộng 43px,
     * mà dòng đó ở Great Vibes 26px dài tới 148px — chữ tự xuống dòng rồi hai
     * dòng chồng lên nhau nằm ngang trong lòng thanh, không đọc ra chữ gì.
     * Nới thanh cho vừa một dòng thì vẫn phải nghiêng đầu mới đọc, mà đây đúng
     * là dòng khách cần đọc nhất của cả phần này. Chữ trang trí tiếng Anh
     * ("Bride", "I love you forever") thì xoay được — ngày cưới thì không, nên
     * tháng và năm dời xuống thanh tiêu đề nằm ngang ngay trên tờ lịch.
     */
    box('sec-date', {
      top: 5040.2, left: 436.1, width: 43, height: 140.5, fill: ROSE, z: 36, anim: MEDIA_LEFT,
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
      // Kèm luôn năm: đây là chỗ duy nhất còn lại trong phần này nói ra năm nào
      text: `{{${v.main}.monthText}} / {{${v.main}.year}}`, font: FORMAL, size: 31, weight: '400',
      color: DEEP, align: 'left', z: 41, anim: IN_LEFT,
    }),
    box('sec-date', {
      top: 5510.7, left: 171.1, width: 315.6, height: 279.1,
      fill: PAPER, opacity: 0.37, border: [1, ROSE], z: 39,
    }),
    createNode('Calendar', 'sec-date', {
      top: 5509.2, left: 176.9, width: 311.1, height: 278.5, zIndex: 40,
      month: `{{${v.main}.datetime}}`,
      // Đánh dấu đúng những mốc mà tấm thiệp này có nói tới. Ngày nào rơi ngoài
      // tháng đang vẽ thì `CalendarNode` tự lọc bỏ, nên mốc khác tháng cũng
      // không làm vỡ lưới.
      markedDates: v.stops.map((stop) => `{{${stop.ev}.datetime}}`),
      markerIcon: SEED_KEYS.heart,
      themeColor: ROSE, color: INK,
      // Chữ số giữ font serif chứ không dùng font thư pháp như tiêu đề: một
      // lưới 7 cột toàn số viết tay là thứ không ai dò ra ngày cưới nằm đâu.
      fontFamily: SERIF, fontSize: 17,
      weekStartsOn: 1, showLunar: false,
      ...fx('slide-up', 0.3),
    }),

    // ═══════════ Trình tự buổi lễ ═══════════
    // Gạch dọc phải dừng đúng ở mốc cuối: kéo dài quá thì thiệp tách còn thừa
    // một đoạn kẻ chỉ vào khoảng trắng.
    box('sec-timeline', {
      top: 5869.7, left: 232, width: 1.5,
      height: (v.stops.length - 1) * TIMELINE_GAP + 52, fill: RULE, anim: MEDIA_UP,
    }),
    ...v.stops.flatMap((stop, i) =>
      timelineRow('sec-timeline', 5866 + i * TIMELINE_GAP, stop.img, stop.size,
        `{{${stop.ev}.dayMonth}} &nbsp;·&nbsp; {{${stop.ev}.time}}<br>${stop.label}`, 42 + i * 3),
    ),

    // ═══════════ Xác nhận tham dự ═══════════
    photo('sec-rsvp', {
      top: 6101, left: 0, width: 498.7, height: 911, img: SEED_KEYS.cover, slot: 'cover', z: 49,
    }),
    box('sec-rsvp', {
      // Cùng lý do với tấm nền phần Lời mời. Để đục hơn một chút vì tấm này
      // đỡ cả cái form — chữ trong ô nhập phải đọc được, không chỉ ngắm.
      top: 6132, left: 37.5, width: 417.8, height: 685.3,
      fill: 'rgba(255, 255, 255, 0.5)', frost: 22, z: 50,
    }),
    text('sec-rsvp', {
      top: 6103.3, left: 14.9, width: 482.6, height: 61,
      text: 'INVITATION', font: SYS, size: 22, color: '#ffffff', spacing: 30, z: 51,
    }),
    photo('sec-rsvp', {
      top: 6160, left: 79.6, width: 340.9, height: 225, img: SEED_KEYS.album[0]!, slot: 'album1', z: 54,
    }),
    text('sec-rsvp', {
      top: 6326.6, left: -172.5, width: 460, height: 56,
      text: 'I love you forever', font: SCRIPT, size: 44, color: DEEP, spacing: 4,
      rotation: 90, z: 56, anim: STILL,
    }),
    photo('sec-rsvp', {
      top: 6402.9, left: 79.6, width: 340.9, height: 184.1, img: SEED_KEYS.album[3]!, slot: 'album4', z: 52,
    }),
    text('sec-rsvp', {
      top: 6541.6, left: 216.6, width: 460, height: 56,
      text: 'Nice to meet you', font: SCRIPT, size: 44, color: DEEP, spacing: 4,
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
      color: INK, buttonColor: ROSE, buttonTextColor: '#ffffff',
      fontFamily: FORMAL, fontSize: 24,
      backgroundColor: '#ffffff',
      padding: [16, 16, 16, 16],
      ...fx('fade', 0),
    }),

    // ═══════════ Mừng cưới ═══════════
    text('sec-gift', {
      top: 7355, left: 29.6, width: 449, height: 128,
      text:
        'Mình rất muốn được chụp chung với bạn những tấm hình kỷ niệm vì vậy ' +
        'hãy đến sớm hơn một chút bạn yêu nhé! Đám cưới của chúng mình sẽ trọn ' +
        'vẹn hơn khi có thêm lời chúc phúc và sự hiện diện của các bạn',
      font: FORMAL, size: 25, weight: '400', color: INK, lineHeight: '1.5', z: 61, anim: STILL,
    }),
    text('sec-gift', {
      top: 7514, left: 91.1, width: 315.6, height: 46,
      text: 'Gửi quà mừng', font: FORMAL, size: 44, weight: '400', color: ROSE, z: 59, anim: STILL,
    }),
    ...giftCard('sec-gift', 7616.8, 'left', {
      role: 'Cô dâu',
      nameToken: '{{bride.fullName}}',
      accountToken: '{{accounts.1.bank}} {{accounts.1.accountNumber}}',
      photoKey: SEED_KEYS.bride, photoSlot: 'bride',
      accountIndex: 1,
      z: 62,
    }),
    ...giftCard('sec-gift', 7857.2, 'right', {
      role: 'Chú rể',
      nameToken: '{{groom.fullName}}',
      accountToken: '{{accounts.0.bank}} {{accounts.0.accountNumber}}',
      photoKey: SEED_KEYS.groom, photoSlot: 'groom',
      accountIndex: 0,
      z: 63,
    }),

    // ═══════════ Cảm ơn ═══════════
    decor('sec-thanks', {
      top: 8077.4, left: 176.5, width: 172.2, height: 172.2, img: SEED_KEYS.coupleFigure,
      z: 72, anim: STILL,
    }),
    text('sec-thanks', {
      top: 8210.4, left: 43.9, width: 404.9, height: 130,
      text: 'Thank you', font: FORMAL, size: 110, weight: '400', color: DEEP, z: 71, anim: STILL,
    }),
  ];

  for (const node of nodes) {
    node.props.top += layout.shift[keyOf(node.sectionId)];
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
