/**
 * Doc mẫu để mở editor lên là có cái để nghịch ngay.
 *
 * Cố tình dùng token {{...}} và một node ảnh có `slot` để thấy được cơ chế tách
 * thiết kế khỏi dữ liệu ngay trong editor.
 */

import { createEmptyDoc, createNode } from '@thiepcuoi/schema';
import type { TemplateDoc } from '@thiepcuoi/schema';

export function sampleDoc(): TemplateDoc {
  const doc = createEmptyDoc('tpl-demo', 'Mẫu demo', 'mau-demo');

  doc.canvas.height = 2100;
  doc.sections = [
    { id: 'sec-cover', name: 'Bìa', top: 0, height: 700, background: { color: '#fdf6f4' } },
    { id: 'sec-info', name: 'Thông tin', top: 700, height: 700, background: { color: '#ffffff' } },
    { id: 'sec-rsvp', name: 'Xác nhận', top: 1400, height: 700, background: { color: '#fdf6f4' } },
  ];
  doc.fonts = [
    { family: 'Quicksand', source: { kind: 'google', name: 'Quicksand' }, weights: [400, 500, 700] },
    { family: 'Playfair Display', source: { kind: 'google', name: 'Playfair Display' }, weights: [400, 700] },
  ];

  const nodes = [
    createNode('Photo', 'sec-cover', {
      top: 40, left: 50, width: 400, height: 420,
      imgKey: 'demo/cover.jpg',
      slot: 'cover',
      borderRadius: [200, 200, 12, 12],
    }),
    createNode('Text', 'sec-cover', {
      top: 490, left: 50, width: 400, height: 60,
      text: '{{groom.shortName}} &amp; {{bride.shortName}}',
      fontFamily: 'Playfair Display', fontSize: 44, color: '#7a2c2c',
    }),
    createNode('Text', 'sec-cover', {
      top: 560, left: 50, width: 400, height: 28,
      text: 'Trân trọng kính mời',
      fontFamily: 'Quicksand', fontSize: 16, color: '#8a7a75', textTransform: 'uppercase', letterSpacing: '0.2em',
    }),
    createNode('Text', 'sec-info', {
      top: 760, left: 50, width: 400, height: 34,
      text: 'Lễ thành hôn',
      fontFamily: 'Playfair Display', fontSize: 28, color: '#7a2c2c',
    }),
    createNode('Calendar', 'sec-info', {
      top: 820, left: 60, width: 380, height: 300,
      month: '2027-03-01T00:00:00.000Z',
      markedDates: ['2027-03-14T00:00:00.000Z'],
      fontFamily: 'Quicksand', themeColor: '#c98b8b',
    }),
    createNode('CountDown', 'sec-info', {
      top: 1150, left: 60, width: 380, height: 96,
      targetDate: '2027-03-14T03:00:00.000Z',
      themeColor: '#7a2c2c', fontFamily: 'Quicksand',
    }),
    createNode('Map', 'sec-info', {
      top: 1280, left: 170, width: 160, height: 40,
      label: 'Xem chỉ đường', query: 'Nhà hàng Hoa Sen, Hà Nội',
      buttonColor: '#7a2c2c', fontFamily: 'Quicksand', borderRadius: [20, 20, 20, 20],
    }),
    createNode('RsvpForm', 'sec-rsvp', {
      top: 1450, left: 75, width: 350, height: 400,
      fontFamily: 'Quicksand', buttonColor: '#7a2c2c',
    }),
    createNode('GiftQr', 'sec-rsvp', {
      top: 1900, left: 200, width: 100, height: 100,
      imgKey: 'demo/gift.png',
      continuousAnimation: { type: 'wobble', duration: 2.4, delay: 0 },
    }),
  ];

  nodes.forEach((node, i) => {
    node.props.zIndex = i;
    doc.nodes[node.id] = node;
    doc.order.push(node.id);
  });

  return doc;
}
