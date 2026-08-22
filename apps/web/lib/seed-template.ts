/**
 * Mẫu "Trọn vẹn" — bản dựng đầy đủ các phần của một tấm thiệp cưới thật.
 *
 * Khác mẫu "Cơ bản" ở chỗ nó dùng gần hết bộ node của engine: ảnh bìa, nhà
 * trai/nhà gái, nhiều sự kiện kèm chỉ đường riêng, lịch, đếm ngược, album,
 * form xác nhận, QR mừng cưới, sổ lưu bút, nhạc nền và hiệu ứng tim rơi.
 *
 * Mọi nội dung cụ thể (tên, ngày, địa chỉ, số tài khoản) đều là token hoặc
 * slot ảnh — cùng một thiết kế dùng lại cho mọi cặp đôi, đổi người chỉ đụng
 * vào `InviteData`.
 *
 * Toạ độ là tuyệt đối trong canvas 500px. Node thuộc section nào thì `top`
 * vẫn tính từ đỉnh canvas, `CanvasRenderer` tự trừ đi `section.top`.
 */

import { createEmptyDoc, createNode } from '@thiepcuoi/schema';
import type { TemplateNode, TemplateDoc } from '@thiepcuoi/schema';
import { SEED_KEYS } from './seed-assets';

const WINE = '#7a2c2c';
const INK = '#4b4340';
const MUTED = '#9b8a86';
const ROSE = '#c98b8b';
const CREAM = '#fdf6f4';

const SERIF = 'Playfair Display';
const SANS = 'Quicksand';
const SCRIPT = 'Dancing Script';

/** Ngày cưới của thiệp mồi. Trùng với `WEDDING_DAY` bên seed.ts. */
export const CEREMONY_DAY = '2027-03-14T07:00:00.000Z';

/**
 * Mốc dọc của từng section — đổi ở đây thì cả section lẫn node bên dưới trôi theo.
 *
 * Mỗi section phải cao hơn node cuối của nó: nền vẽ theo đúng chiều cao khai
 * báo, nên node tràn ra ngoài sẽ bị vạch nền của section kế tiếp cắt ngang.
 * `sec-ceremony` cần 700 vì nó chứa hai khối sự kiện chồng lên nhau.
 */
const Y = {
  hero: 0,
  parents: 760,
  couple: 1360,
  events: 2060,
  ceremony: 2820,
  calendar: 3520,
  quote: 4200,
  album: 4680,
  rsvp: 5360,
  gift: 5900,
  wishes: 6200,
  end: 6800,
};


/** Chữ nhỏ in hoa giãn cách — mô-típ lặp lại nhiều lần trong mẫu */
function eyebrow(section: string, top: number, text: string, color = MUTED) {
  return createNode('Text', section, {
    top, left: 50, width: 400, height: 24,
    text, fontFamily: SANS, fontSize: 12, color,
    textTransform: 'uppercase', letterSpacing: '0.34em',
  });
}

/** Gạch ngang mảnh ngăn giữa các khối */
function divider(section: string, top: number, width = 60) {
  return createNode('Text', section, {
    top, left: (500 - width) / 2, width, height: 2,
    text: '', backgroundColor: ROSE, opacity: 0.5,
  });
}

function body(section: string, top: number, text: string, height = 44) {
  return createNode('Text', section, {
    top, left: 45, width: 410, height,
    text, fontFamily: SANS, fontSize: 14, color: INK, lineHeight: '1.7',
  });
}

/**
 * Một khối "bên nhà": tiêu đề, tên ông bà, địa chỉ.
 * Dùng cho cả nhà trai và nhà gái nên nhận prefix token.
 */
function partyBlock(section: string, top: number, title: string, prefix: 'groom' | 'bride') {
  return [
    createNode('Text', section, {
      top, left: 40, width: 420, height: 26,
      text: title, fontFamily: SANS, fontSize: 13, color: WINE,
      textTransform: 'uppercase', letterSpacing: '0.24em', fontWeight: '600',
    }),
    createNode('Text', section, {
      top: top + 32, left: 40, width: 420, height: 26,
      text: `Ông : {{${prefix}.father}}`, fontFamily: SANS, fontSize: 15, color: INK,
    }),
    createNode('Text', section, {
      top: top + 58, left: 40, width: 420, height: 26,
      text: `Bà : {{${prefix}.mother}}`, fontFamily: SANS, fontSize: 15, color: INK,
    }),
    createNode('Text', section, {
      top: top + 86, left: 40, width: 420, height: 24,
      text: `{{${prefix}.address}}`, fontFamily: SANS, fontSize: 13, color: MUTED,
    }),
  ];
}

/**
 * Một sự kiện: tên tiệc, thứ/giờ, ngày, âm lịch, nơi tổ chức, nút chỉ đường.
 * `index` trỏ vào `InviteData.events[index]`.
 */
function eventBlock(section: string, top: number, index: number, label: string) {
  const ev = `events.${index}`;
  return [
    createNode('Text', section, {
      top, left: 40, width: 420, height: 26,
      text: label, fontFamily: SANS, fontSize: 12, color: WINE,
      textTransform: 'uppercase', letterSpacing: '0.28em', fontWeight: '600',
    }),
    createNode('Text', section, {
      top: top + 30, left: 40, width: 420, height: 30,
      text: `{{${ev}.weekdayTime}}`, fontFamily: SANS, fontSize: 15, color: INK,
      textTransform: 'uppercase', letterSpacing: '0.14em',
    }),
    createNode('Text', section, {
      top: top + 62, left: 40, width: 420, height: 44,
      text: `{{${ev}.dateText}}`, fontFamily: SERIF, fontSize: 30, color: WINE,
    }),
    createNode('Text', section, {
      top: top + 110, left: 40, width: 420, height: 22,
      text: `{{${ev}.lunarText}}`, fontFamily: SANS, fontSize: 12, color: MUTED,
      fontStyle: 'italic',
    }),
    createNode('Text', section, {
      top: top + 136, left: 40, width: 420, height: 24,
      text: `{{${ev}.venue}}`, fontFamily: SANS, fontSize: 14, color: INK, fontWeight: '600',
      textTransform: 'uppercase', letterSpacing: '0.1em',
    }),
    createNode('Text', section, {
      top: top + 162, left: 40, width: 420, height: 24,
      text: `{{${ev}.address}}`, fontFamily: SANS, fontSize: 13, color: MUTED,
    }),
    createNode('Map', section, {
      top: top + 194, left: 170, width: 160, height: 38,
      label: 'Xem chỉ đường',
      query: `{{${ev}.venue}} {{${ev}.address}}`,
      buttonColor: WINE, color: '#ffffff', fontFamily: SANS, fontSize: 13,
      borderRadius: [19, 19, 19, 19],
    }),
  ];
}

export function fullTemplate(): TemplateDoc {
  const doc = createEmptyDoc('tpl-tron-ven', 'Trọn vẹn', 'tron-ven');

  doc.canvas.height = Y.end;
  doc.canvas.background = '#ffffff';

  doc.sections = [
    { id: 'sec-hero', name: 'Bìa', top: Y.hero, height: Y.parents - Y.hero, background: { color: CREAM } },
    { id: 'sec-parents', name: 'Nhà có hỷ', top: Y.parents, height: Y.couple - Y.parents, background: { color: '#ffffff' } },
    { id: 'sec-couple', name: 'Cô dâu chú rể', top: Y.couple, height: Y.events - Y.couple, background: { color: CREAM } },
    { id: 'sec-events', name: 'Tiệc cưới', top: Y.events, height: Y.ceremony - Y.events, background: { color: '#ffffff' } },
    { id: 'sec-ceremony', name: 'Nghi lễ', top: Y.ceremony, height: Y.calendar - Y.ceremony, background: { color: CREAM } },
    { id: 'sec-calendar', name: 'Lịch & đếm ngược', top: Y.calendar, height: Y.quote - Y.calendar, background: { color: '#ffffff' } },
    { id: 'sec-quote', name: 'Lời mời', top: Y.quote, height: Y.album - Y.quote, background: { color: CREAM } },
    { id: 'sec-album', name: 'Album', top: Y.album, height: Y.rsvp - Y.album, background: { color: '#ffffff' } },
    { id: 'sec-rsvp', name: 'Xác nhận', top: Y.rsvp, height: Y.gift - Y.rsvp, background: { color: CREAM } },
    { id: 'sec-gift', name: 'Mừng cưới', top: Y.gift, height: Y.wishes - Y.gift, background: { color: '#ffffff' } },
    { id: 'sec-wishes', name: 'Lưu bút', top: Y.wishes, height: Y.end - Y.wishes, background: { color: CREAM } },
  ];

  doc.fonts = [
    { family: SANS, source: { kind: 'google', name: 'Quicksand' }, weights: [400, 500, 600, 700] },
    { family: SERIF, source: { kind: 'google', name: 'Playfair Display' }, weights: [400, 700] },
    { family: SCRIPT, source: { kind: 'google', name: 'Dancing Script' }, weights: [400, 700] },
  ];

  doc.effects.falling = { enabled: true, kind: 'heart', imgKey: null, density: 16, speed: 0.7 };

  // Nhạc nền để trống: chưa có file nhạc nào trong kho, mà `AudioToggle` trỏ
  // vào key rỗng thì ra một thẻ <audio src=""> hỏng. Chủ thiệp tải mp3 lên rồi
  // đặt `doc.audio.key` là nút nhạc hiện ra ngay, không phải sửa gì thêm.
  doc.audio = null;

  const nodes: TemplateNode[] = [
    // ─────────────── Bìa ───────────────
    createNode('Photo', 'sec-hero', {
      top: 0, left: 0, width: 500, height: 760,
      imgKey: SEED_KEYS.cover, slot: 'cover', objectFit: 'cover', isReplaceable: true,
      transition: { effectType: 'fade', effectDuration: 1.4, effectDelay: 0, effectEasing: 'ease-out', effectEnabled: true },
    }),
    // Lớp phủ tối nhẹ để chữ trắng còn đọc được trên ảnh sáng
    createNode('Text', 'sec-hero', {
      top: 0, left: 0, width: 500, height: 760,
      text: '', backgroundColor: 'rgba(38, 18, 18, 0.28)',
    }),
    eyebrow('sec-hero', 92, 'Thư mời tiệc cưới', 'rgba(255,255,255,0.85)'),
    createNode('Text', 'sec-hero', {
      top: 130, left: 40, width: 420, height: 44,
      text: 'Lễ thành hôn', fontFamily: SERIF, fontSize: 26, color: '#ffffff',
      letterSpacing: '0.16em', textTransform: 'uppercase',
    }),
    createNode('Text', 'sec-hero', {
      top: 396, left: 40, width: 420, height: 96,
      text: '{{groom.shortName}}<br>&amp;<br>{{bride.shortName}}',
      fontFamily: SCRIPT, fontSize: 56, color: '#ffffff', lineHeight: '1.05',
      textStroke: null,
    }),
    divider('sec-hero', 610, 80),
    createNode('Text', 'sec-hero', {
      top: 630, left: 40, width: 420, height: 32,
      text: '{{events.0.dateText}}', fontFamily: SANS, fontSize: 20, color: '#ffffff',
      fontWeight: '600', letterSpacing: '0.18em',
    }),
    createNode('Text', 'sec-hero', {
      top: 666, left: 40, width: 420, height: 26,
      text: '{{events.0.weekdayTime}}', fontFamily: SANS, fontSize: 13,
      color: 'rgba(255,255,255,0.88)', letterSpacing: '0.2em', textTransform: 'uppercase',
    }),

    // ─────────────── Nhà có hỷ ───────────────
    createNode('Text', 'sec-parents', {
      top: Y.parents + 48, left: 40, width: 420, height: 60,
      text: 'Nhà Có Hỷ', fontFamily: SCRIPT, fontSize: 42, color: WINE,
    }),
    divider('sec-parents', Y.parents + 118),
    ...partyBlock('sec-parents', Y.parents + 150, 'Nhà trai', 'groom'),
    divider('sec-parents', Y.parents + 290, 40),
    ...partyBlock('sec-parents', Y.parents + 320, 'Nhà gái', 'bride'),
    createNode('Text', 'sec-parents', {
      top: Y.parents + 470, left: 40, width: 420, height: 60,
      text: 'Trân trọng báo tin lễ thành hôn của hai con chúng tôi',
      fontFamily: SANS, fontSize: 13, color: MUTED, lineHeight: '1.8', fontStyle: 'italic',
    }),

    // ─────────────── Cô dâu chú rể ───────────────
    createNode('Photo', 'sec-couple', {
      top: Y.couple + 60, left: 60, width: 175, height: 230,
      imgKey: SEED_KEYS.groom, slot: 'groom', objectFit: 'cover', isReplaceable: true,
      borderRadius: [88, 88, 8, 8],
    }),
    createNode('Photo', 'sec-couple', {
      top: Y.couple + 60, left: 265, width: 175, height: 230,
      imgKey: SEED_KEYS.bride, slot: 'bride', objectFit: 'cover', isReplaceable: true,
      borderRadius: [88, 88, 8, 8],
    }),
    createNode('Text', 'sec-couple', {
      top: Y.couple + 304, left: 40, width: 180, height: 30,
      text: '{{groom.fullName}}', fontFamily: SERIF, fontSize: 19, color: WINE,
    }),
    createNode('Text', 'sec-couple', {
      top: Y.couple + 304, left: 280, width: 180, height: 30,
      text: '{{bride.fullName}}', fontFamily: SERIF, fontSize: 19, color: WINE,
    }),
    createNode('Text', 'sec-couple', {
      top: Y.couple + 306, left: 230, width: 40, height: 30,
      text: '&amp;', fontFamily: SCRIPT, fontSize: 26, color: ROSE,
    }),
    createNode('Photo', 'sec-couple', {
      top: Y.couple + 360, left: 90, width: 320, height: 260,
      imgKey: SEED_KEYS.couple, slot: 'couple', objectFit: 'cover', isReplaceable: true,
      borderRadius: [10, 10, 10, 10],
    }),

    // ─────────────── Tiệc cưới ───────────────
    eyebrow('sec-events', Y.events + 44, 'Thư mời tham dự'),
    ...eventBlock('sec-events', Y.events + 92, 1, 'Tiệc cưới nhà trai'),
    divider('sec-events', Y.events + 372, 40),
    ...eventBlock('sec-events', Y.events + 412, 2, 'Tiệc cưới nhà gái'),

    // ─────────────── Nghi lễ ───────────────
    createNode('Text', 'sec-ceremony', {
      top: Y.ceremony + 44, left: 40, width: 420, height: 34,
      text: '❤', fontFamily: SANS, fontSize: 22, color: ROSE,
      continuousAnimation: { type: 'heartbeat', duration: 1.8, delay: 0 },
    }),
    ...eventBlock('sec-ceremony', Y.ceremony + 92, 3, 'Lễ vu quy'),
    divider('sec-ceremony', Y.ceremony + 356, 40),
    ...eventBlock('sec-ceremony', Y.ceremony + 396, 0, 'Lễ thành hôn'),

    // ─────────────── Lịch & đếm ngược ───────────────
    eyebrow('sec-calendar', Y.calendar + 48, 'Ngày chúng mình về chung một nhà'),
    createNode('Calendar', 'sec-calendar', {
      top: Y.calendar + 90, left: 60, width: 380, height: 300,
      month: CEREMONY_DAY, markedDates: [CEREMONY_DAY],
      fontFamily: SANS, fontSize: 13, themeColor: ROSE, color: INK,
      weekStartsOn: 1, showLunar: false,
    }),
    createNode('CountDown', 'sec-calendar', {
      top: Y.calendar + 420, left: 50, width: 400, height: 96,
      targetDate: CEREMONY_DAY, themeColor: WINE, color: '#ffffff',
      fontFamily: SANS, fontSize: 15, spacing: 10,
      expiredText: 'Chúng mình đã về chung một nhà',
    }),
    createNode('Text', 'sec-calendar', {
      top: Y.calendar + 540, left: 40, width: 420, height: 40,
      text: '{{groom.shortName}} - {{bride.shortName}}',
      fontFamily: SCRIPT, fontSize: 28, color: WINE,
    }),

    // ─────────────── Lời mời ───────────────
    createNode('Text', 'sec-quote', {
      top: Y.quote + 56, left: 40, width: 420, height: 70,
      text: 'Love You', fontFamily: SCRIPT, fontSize: 48, color: ROSE,
    }),
    eyebrow('sec-quote', Y.quote + 144, 'Invitation', WINE),
    divider('sec-quote', Y.quote + 178, 44),
    body('sec-quote', Y.quote + 206,
      'Chúng mình sắp bắt đầu một hành trình mới cùng nhau.<br>' +
      'Niềm vui này sẽ trọn vẹn hơn khi có bạn bên cạnh.', 60),
    body('sec-quote', Y.quote + 282, '{{message}}', 90),

    // ─────────────── Album ───────────────
    eyebrow('sec-album', Y.album + 48, 'Khoảnh khắc của chúng mình'),
    createNode('Gallery', 'sec-album', {
      top: Y.album + 92, left: 40, width: 420, height: 500,
      photos: SEED_KEYS.album.map((key, i) => ({
        id: `ga-${i + 1}`, imageKey: key, alt: `Ảnh cưới ${i + 1}`,
      })),
      layout: 'carousel', showThumbnails: true, showNavButtons: true,
      showFullscreenButton: true, autoplay: true, autoplayInterval: 4500,
      borderRadius: [10, 10, 10, 10],
    }),

    // ─────────────── Xác nhận tham dự ───────────────
    createNode('RsvpForm', 'sec-rsvp', {
      top: Y.rsvp + 50, left: 40, width: 420, height: 430,
      titleText: 'Xác nhận tham dự',
      nameLabel: 'Họ và tên',
      attendLabel: 'Bạn sẽ tham dự chứ?',
      attendYesText: 'Có, tôi sẽ tham dự',
      attendNoText: 'Tôi bận, rất tiếc không thể tham dự',
      enableAttendeeCount: true,
      attendeeCountLabel: 'Số lượng người tham dự',
      enableGuestSide: true,
      guestSideLabel: 'Bạn là khách mời của ai ?',
      guestSideGroomText: 'Nhà trai',
      guestSideBrideText: 'Nhà gái',
      // Đưa chỗ gửi lời chúc ra thanh công cụ nổi, giống thiệp tham chiếu:
      // form xác nhận giữ đúng bốn câu hỏi, không dài thêm.
      enableMessage: false,
      enableTransportation: false,
      submitText: 'Gửi xác nhận',
      successText: 'Cảm ơn bạn! Hẹn gặp trong ngày vui.',
      fontFamily: SANS, fontSize: 14, color: INK,
      buttonColor: WINE, buttonTextColor: '#ffffff',
      backgroundColor: '#ffffff', borderRadius: [12, 12, 12, 12],
      padding: [18, 18, 18, 18],
      hasShadow: true,
    }),

    // ─────────────── Mừng cưới ───────────────
    createNode('Text', 'sec-gift', {
      top: Y.gift + 56, left: 40, width: 420, height: 34,
      text: 'Gửi quà mừng tới Cô Dâu - Chú Rể',
      fontFamily: SANS, fontSize: 15, color: INK,
    }),
    createNode('GiftQr', 'sec-gift', {
      top: Y.gift + 110, left: 210, width: 80, height: 80,
      imgKey: SEED_KEYS.giftIcon,
      modalTitle: 'Mừng cưới cô dâu chú rể',
      accounts: [],
      borderRadius: [40, 40, 40, 40],
    }),
    createNode('Text', 'sec-gift', {
      top: Y.gift + 208, left: 40, width: 420, height: 44,
      text: 'Chạm vào để xem thông tin chuyển khoản',
      fontFamily: SANS, fontSize: 12, color: MUTED, fontStyle: 'italic',
    }),

    // ─────────────── Lưu bút ───────────────
    eyebrow('sec-wishes', Y.wishes + 44, 'Sổ lưu bút'),
    createNode('Wishes', 'sec-wishes', {
      top: Y.wishes + 84, left: 40, width: 420, height: 470,
      titleText: 'Lời chúc từ mọi người',
      emptyText: 'Hãy là người đầu tiên gửi lời chúc tới hai bạn',
      maxVisible: 30,
      fontFamily: SANS, fontSize: 14, color: INK,
      backgroundColor: '#ffffff', borderRadius: [12, 12, 12, 12],
      padding: [16, 16, 16, 16],
    }),
  ];

  nodes.forEach((node, i) => {
    node.props.zIndex = i;
    doc.nodes[node.id] = node;
    doc.order.push(node.id);
  });

  assertNodesFitSections(doc);
  return doc;
}

/**
 * Node tràn khỏi section của nó vẫn vẽ ra, nhưng nền của section kế tiếp sẽ cắt
 * ngang giữa nó — nhìn như lỗi hiển thị ngẫu nhiên và rất khó truy ngược. Dịch
 * một mốc trong `Y` là đủ gây ra, nên kiểm ngay lúc dựng mẫu thay vì lúc nhìn.
 */
function assertNodesFitSections(doc: TemplateDoc): void {
  const bounds = new Map(doc.sections.map((s) => [s.id, s]));
  const problems: string[] = [];

  for (const node of Object.values(doc.nodes)) {
    const section = bounds.get(node.sectionId);
    if (!section) {
      problems.push(`${node.name} trỏ tới section không có: ${node.sectionId}`);
      continue;
    }
    const bottom = node.props.top + node.props.height;
    const limit = section.top + section.height;
    if (node.props.top < section.top) {
      problems.push(`${node.name} (top ${node.props.top}) nằm trên đỉnh section "${section.name}" (${section.top})`);
    }
    if (bottom > limit) {
      problems.push(`${node.name} chạm ${bottom}, vượt đáy section "${section.name}" (${limit})`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Mẫu "Trọn vẹn" có node lệch section:\n  - ${problems.join('\n  - ')}`);
  }
}
