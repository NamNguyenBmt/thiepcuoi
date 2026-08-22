/**
 * Dữ liệu mồi: 2 template + 1 thiệp đã phát hành.
 *
 * Template dùng token {{...}} và slot ảnh, còn thiệp chỉ mang InviteData — đúng
 * mô hình tách thiết kế khỏi nội dung. Đổi tên cô dâu chú rể chỉ động vào
 * `invites`, template không phải nhân bản.
 *
 * "Cơ bản" giữ lại làm ví dụ tối giản cho người mới dựng mẫu; "Trọn vẹn" là
 * bản đầy đủ các phần của một tấm thiệp thật, và là mẫu mà thiệp mồi dùng.
 */

import { createEmptyDoc, createNode, packDoc } from '@thiepcuoi/schema';
import type { InviteData, TemplateDoc } from '@thiepcuoi/schema';
import type { Database } from './db';
import { randomBytes } from 'node:crypto';
import { hashPassword } from './auth';
import { buildSeedAssets, SEED_KEYS } from './seed-assets';
import { fullTemplate, CEREMONY_DAY } from './seed-template';
import { sweetTemplate } from './seed-template-42';

/**
 * Tài khoản khởi tạo.
 *
 * Không đặt `SEED_PASSWORD` thì sinh mật khẩu ngẫu nhiên rồi in ra log server —
 * mật khẩu mặc định đoán được là thứ đầu tiên bị dò khi lỡ mở ra internet.
 */
const SEED_EMAIL = process.env.SEED_EMAIL ?? 'admin@thiepcuoi.local';
const SEED_USER_ID = 'usr-admin';

function seedPassword(): string {
  const given = process.env.SEED_PASSWORD;
  if (given) return given;

  const generated = randomBytes(12).toString('base64url');
  console.warn(`[seed] Đã tạo tài khoản ${SEED_EMAIL} với mật khẩu: ${generated}`);
  console.warn('[seed] Ghi lại ngay — chỉ hiện một lần. Đổi sau bằng: npm run passwd -- <email>');
  return generated;
}

const WEDDING_DAY = CEREMONY_DAY;

export function demoTemplate(): TemplateDoc {
  const doc = createEmptyDoc('tpl-co-ban', 'Cơ bản', 'co-ban');

  doc.canvas.height = 2400;
  doc.sections = [
    { id: 'sec-cover', name: 'Bìa', top: 0, height: 720, background: { color: '#fdf6f4' } },
    { id: 'sec-info', name: 'Thông tin', top: 720, height: 780, background: { color: '#ffffff' } },
    { id: 'sec-rsvp', name: 'Xác nhận', top: 1500, height: 900, background: { color: '#fdf6f4' } },
  ];
  doc.fonts = [
    { family: 'Quicksand', source: { kind: 'google', name: 'Quicksand' }, weights: [400, 500, 700] },
    { family: 'Playfair Display', source: { kind: 'google', name: 'Playfair Display' }, weights: [400, 700] },
  ];
  doc.effects.falling = { enabled: true, kind: 'heart', imgKey: null, density: 14, speed: 0.8 };

  const nodes = [
    createNode('Text', 'sec-cover', {
      top: 90, left: 50, width: 400, height: 40,
      text: 'Save the date', fontFamily: 'Quicksand', fontSize: 15, color: '#a08b86',
      textTransform: 'uppercase', letterSpacing: '0.32em',
    }),
    createNode('Text', 'sec-cover', {
      top: 140, left: 50, width: 400, height: 70,
      text: '{{groom.shortName}} &amp; {{bride.shortName}}',
      fontFamily: 'Playfair Display', fontSize: 46, color: '#7a2c2c',
    }),
    createNode('Photo', 'sec-cover', {
      top: 240, left: 75, width: 350, height: 400, imgKey: '', slot: 'cover',
      borderRadius: [175, 175, 16, 16],
    }),
    createNode('Text', 'sec-cover', {
      top: 660, left: 50, width: 400, height: 30,
      text: '{{events.0.dateText}}', fontFamily: 'Quicksand', fontSize: 20, color: '#7a2c2c', fontWeight: '600',
    }),

    createNode('Text', 'sec-info', {
      top: 770, left: 50, width: 400, height: 40,
      text: 'Lễ thành hôn', fontFamily: 'Playfair Display', fontSize: 30, color: '#7a2c2c',
    }),
    createNode('Text', 'sec-info', {
      top: 820, left: 40, width: 420, height: 60,
      text: '{{events.0.venue}}<br>{{events.0.address}}',
      fontFamily: 'Quicksand', fontSize: 15, color: '#4b4340', lineHeight: '1.6',
    }),
    createNode('Calendar', 'sec-info', {
      top: 900, left: 60, width: 380, height: 300,
      month: WEDDING_DAY, markedDates: [WEDDING_DAY],
      fontFamily: 'Quicksand', themeColor: '#c98b8b',
    }),
    createNode('CountDown', 'sec-info', {
      top: 1230, left: 60, width: 380, height: 96,
      targetDate: WEDDING_DAY, themeColor: '#7a2c2c', fontFamily: 'Quicksand',
    }),
    createNode('Map', 'sec-info', {
      top: 1370, left: 170, width: 160, height: 40,
      label: 'Xem chỉ đường', query: '{{events.0.venue}} {{events.0.address}}',
      buttonColor: '#7a2c2c', fontFamily: 'Quicksand', borderRadius: [20, 20, 20, 20],
    }),

    createNode('RsvpForm', 'sec-rsvp', {
      top: 1560, left: 75, width: 350, height: 420,
      fontFamily: 'Quicksand', buttonColor: '#7a2c2c',
    }),
    createNode('Wishes', 'sec-rsvp', {
      top: 2010, left: 60, width: 380, height: 300,
      fontFamily: 'Quicksand', titleText: 'Sổ lưu bút',
    }),
  ];

  nodes.forEach((node, i) => {
    node.props.zIndex = i;
    doc.nodes[node.id] = node;
    doc.order.push(node.id);
  });

  return doc;
}

/**
 * Thứ tự sự kiện là hợp đồng giữa template và dữ liệu: `seed-template.ts` trỏ
 * vào `events.0` … `events.3`. Đổi thứ tự ở đây thì mẫu hiện sai chỗ.
 *   0 = lễ thành hôn, 1 = tiệc nhà trai, 2 = tiệc nhà gái, 3 = lễ vu quy
 */
function demoInviteData(): InviteData {
  return {
    groom: {
      fullName: 'Trần Minh Quân', shortName: 'Quân', birthday: '05 / 08 / 1995',
      father: 'Trần Văn Hùng', mother: 'Lê Thị Hoa',
      address: 'Trung Hoà - Cầu Giấy - Hà Nội',
    },
    bride: {
      fullName: 'Phạm Ngọc Lan', shortName: 'Lan', birthday: '12 / 05 / 2000',
      father: 'Phạm Đức Thắng', mother: 'Vũ Thị Bình',
      address: 'Thạch Thang - Hải Châu - Đà Nẵng',
    },
    events: [
      {
        id: 'ev-thanh-hon', title: 'Lễ thành hôn', datetime: WEDDING_DAY,
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Tại tư gia nhà trai',
        address: 'Trung Hoà - Cầu Giấy - Hà Nội',
        lat: 21.0086, lng: 105.7996,
      },
      {
        id: 'ev-tiec-trai', title: 'Tiệc cưới nhà trai', datetime: '2027-03-14T02:30:00.000Z',
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Trung tâm tiệc cưới Mùa Xuân',
        address: '18 Trần Duy Hưng, Cầu Giấy, Hà Nội',
        lat: 21.0086, lng: 105.7996,
      },
      {
        id: 'ev-tiec-gai', title: 'Tiệc cưới nhà gái', datetime: '2027-03-13T11:00:00.000Z',
        lunarText: 'Tức ngày 06 tháng 02 năm Đinh Mùi',
        venue: 'Nhà hàng Sen Vàng',
        address: '25 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
        lat: 16.0605, lng: 108.2214,
      },
      {
        id: 'ev-vu-quy', title: 'Lễ vu quy', datetime: '2027-03-14T02:00:00.000Z',
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Tại tư gia nhà gái',
        address: 'Thạch Thang - Hải Châu - Đà Nẵng',
        lat: 16.0748, lng: 108.2211,
      },
    ],
    photos: {
      cover: SEED_KEYS.cover,
      couple: SEED_KEYS.couple,
      groom: SEED_KEYS.groom,
      bride: SEED_KEYS.bride,
      album1: SEED_KEYS.album[0]!,
      album2: SEED_KEYS.album[1]!,
      album3: SEED_KEYS.album[2]!,
      album4: SEED_KEYS.album[3]!,
      qrGroom: SEED_KEYS.qrGroom,
      qrBride: SEED_KEYS.qrBride,
    },
    accounts: [
      {
        id: 'acc-groom', displayName: 'Chú rể', name: 'TRAN MINH QUAN',
        accountNumber: '0123456789', bank: 'Vietcombank', qrCode: SEED_KEYS.qrGroom,
      },
      {
        id: 'acc-bride', displayName: 'Cô dâu', name: 'PHAM NGOC LAN',
        accountNumber: '9876543210', bank: 'Techcombank', qrCode: SEED_KEYS.qrBride,
      },
    ],
    message:
      'Cuộc sống quý giá không chỉ ở đích đến, mà còn ở những khoảnh khắc ' +
      'chia sẻ cùng nhau. Vì vậy chúng mình mong được bạn chung vui trong ' +
      'ngày hạnh phúc này.',
  };
}

export async function seedDatabase(): Promise<Database> {
  const basic = demoTemplate();
  const full = fullTemplate();
  const sweet = sweetTemplate();
  const assets = await buildSeedAssets(SEED_USER_ID);
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: SEED_USER_ID,
        email: SEED_EMAIL.toLowerCase(),
        name: 'Quản trị',
        passwordHash: await hashPassword(seedPassword()),
        role: 'admin',
        createdAt: now,
      },
    ],
    sessions: [],
    assets: assets.map((a) => ({ ...a.row, createdAt: now })),
    templates: [basic, full, sweet].map((doc) => ({
      id: doc.id,
      slug: doc.slug,
      name: doc.name,
      ownerId: SEED_USER_ID,
      docPacked: packDoc(doc),
      thumbnail: null,
      usageCount: doc.id === sweet.id ? 1 : 0,
      revision: 1,
    })),
    invites: [
      {
        id: 'inv-quan-lan',
        slug: 'quan-lan',
        ownerId: SEED_USER_ID,
        templateId: sweet.id,
        data: demoInviteData(),
        publishedAt: now,
      },
    ],
    rsvps: [],
    wishes: [],
  };
}
