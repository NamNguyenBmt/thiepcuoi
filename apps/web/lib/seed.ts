/**
 * Dữ liệu mồi: 5 template + 3 thiệp đã phát hành.
 *
 * Template dùng token {{...}} và slot ảnh, còn thiệp chỉ mang InviteData — đúng
 * mô hình tách thiết kế khỏi nội dung. Đổi tên cô dâu chú rể chỉ động vào
 * `invites`, template không phải nhân bản.
 *
 * "Cơ bản" giữ lại làm ví dụ tối giản cho người mới dựng mẫu; "Trọn vẹn" là
 * bản đầy đủ các phần của một tấm thiệp thật. "Ngọt ngào" có ba biến thể —
 * bản gộp cả hai buổi, bản chỉ vu quy, bản chỉ thành hôn — và hai thiệp mồi
 * cuối chính là một đám cưới được tách làm hai tấm cho hai họ.
 */

import { createEmptyDoc, createNode, packDoc } from '@thiepcuoi/schema';
import type { InviteData, TemplateDoc, TemplateNode } from '@thiepcuoi/schema';
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
      month: '{{events.0.datetime}}', markedDates: ['{{events.0.datetime}}'],
      fontFamily: 'Quicksand', themeColor: '#c98b8b',
    }),
    createNode('CountDown', 'sec-info', {
      top: 1230, left: 60, width: 380, height: 96,
      targetDate: '{{events.0.datetime}}', themeColor: '#7a2c2c', fontFamily: 'Quicksand',
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

/**
 * Dữ liệu cho mẫu "Ngọt ngào" — thứ tự sự kiện KHÁC `demoInviteData`.
 *
 * Mẫu đó in tiệc riêng của từng nhà và không có lễ rước dâu; mẫu này thì ngược
 * lại. Hai bộ dữ liệu chứ không một bộ dùng chung, vì `events.0` là một chỉ số
 * chứ không phải một cái tên — nhét cả hai cách đánh số vào một mảng thì mẫu
 * nào cũng đọc trúng ô của mẫu kia.
 *   0 = tiệc vu quy (nhà gái), 1 = tiệc thành hôn (nhà trai), 2 = lễ rước dâu
 *
 * Ba mốc trải ba ngày liền nhau, đúng nhịp một đám cưới xa nhà: nhà gái đãi
 * trước, hôm sau rước dâu, hôm sau nữa nhà trai đãi.
 */
function sweetInviteData(): InviteData {
  return {
    ...demoInviteData(),
    events: [
      {
        id: 'ev-vu-quy', title: 'Lễ vu quy', datetime: '2027-03-13T04:00:00.000Z',
        lunarText: 'Tức ngày 06 tháng 02 năm Đinh Mùi',
        venue: 'Nhà hàng Sen Vàng',
        address: '25 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
        lat: 16.0605, lng: 108.2214,
      },
      {
        id: 'ev-thanh-hon', title: 'Lễ thành hôn', datetime: '2027-03-15T04:00:00.000Z',
        lunarText: 'Tức ngày 08 tháng 02 năm Đinh Mùi',
        venue: 'Trung tâm tiệc cưới Mùa Xuân',
        address: '18 Trần Duy Hưng, Cầu Giấy, Hà Nội',
        lat: 21.0086, lng: 105.7996,
      },
      {
        id: 'ev-ruoc-dau', title: 'Lễ rước dâu', datetime: WEDDING_DAY,
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Tại tư gia nhà gái',
        address: 'Thạch Thang - Hải Châu - Đà Nẵng',
        lat: 16.0748, lng: 108.2211,
      },
    ],
  };
}

/**
 * Mọi mẫu dựng sẵn của repo, theo đúng thứ tự nạp.
 *
 * Một nguồn duy nhất cho ba chỗ cần biết danh sách này: `seedDatabase` lúc dựng
 * database mới, `syncBuiltinTemplates` lúc khởi động, và `scripts/seed-templates`
 * khi muốn ghi đè bản đã có. Thêm mẫu mà quên một chỗ thì mẫu đó không bao giờ
 * tới được production.
 */
export function builtinTemplates(): TemplateDoc[] {
  return [
    demoTemplate(),
    fullTemplate(),
    sweetTemplate(),
    sweetTemplate('vu-quy'),
    sweetTemplate('thanh-hon'),
  ].map(withStableIds);
}

/**
 * Đánh lại id node theo thứ tự, thay cho uuid ngẫu nhiên của `createNode`.
 *
 * Một mẫu dựng sẵn phải dựng lại được y hệt: cùng mã nguồn thì cùng byte. Với
 * uuid, mỗi lần gọi ra một doc khác nhau ở từng id, nên `packDoc` cho chuỗi
 * khác — và bước đồng bộ lúc khởi động, vốn so nội dung để biết mẫu có đổi
 * không, sẽ thấy "đổi" ở mọi cold start: ghi đè liên tục, `revision` tăng vô
 * hạn, và editor của chủ thiệp bị báo xung đột dù chẳng ai sửa gì.
 *
 * Không có gì trong doc trỏ tới id node (section tham chiếu ngược, slot ảnh gọi
 * theo tên), nên đánh lại là an toàn.
 */
function withStableIds(doc: TemplateDoc): TemplateDoc {
  const nodes: Record<string, TemplateNode> = {};
  const order: string[] = [];

  doc.order.forEach((oldId, i) => {
    const node = doc.nodes[oldId];
    if (!node) return;
    node.id = `${doc.id}-n${String(i).padStart(3, '0')}`;
    nodes[node.id] = node;
    order.push(node.id);
  });

  doc.nodes = nodes;
  doc.order = order;
  return doc;
}

export async function seedDatabase(): Promise<Database> {
  const docs = builtinTemplates();
  const [, full, , sweetVuQuy, sweetThanhHon] = docs;
  const assets = await buildSeedAssets(SEED_USER_ID);
  const now = new Date().toISOString();

  /**
   * Cùng một đám cưới, hai tấm thiệp: khách nhà gái nhận bản vu quy, khách nhà
   * trai nhận bản thành hôn. Cùng `sweetInviteData()` — chỉ khác mẫu, nên sửa
   * một chỗ trong dữ liệu là cả hai tấm đổi theo.
   */
  const invites = [
    // Dữ liệu 4 sự kiện của thiệp này viết theo hợp đồng của mẫu "Trọn vẹn"
    { id: 'inv-quan-lan', slug: 'quan-lan', templateId: full!.id, data: demoInviteData() },
    {
      id: 'inv-quan-lan-vu-quy', slug: 'quan-lan-vu-quy',
      templateId: sweetVuQuy!.id, data: sweetInviteData(),
    },
    {
      id: 'inv-quan-lan-thanh-hon', slug: 'quan-lan-thanh-hon',
      templateId: sweetThanhHon!.id, data: sweetInviteData(),
    },
  ];

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
    templates: docs.map((doc) => ({
      id: doc.id,
      slug: doc.slug,
      name: doc.name,
      ownerId: SEED_USER_ID,
      docPacked: packDoc(doc),
      thumbnail: null,
      usageCount: invites.filter((inv) => inv.templateId === doc.id).length,
      revision: 1,
    })),
    invites: invites.map((inv) => ({ ...inv, ownerId: SEED_USER_ID, publishedAt: now })),
    rsvps: [],
    wishes: [],
  };
}
