/**
 * Dữ liệu giả cho trang xem thử mẫu.
 *
 * Không dùng `data: null`: ở mode 'render' token không resolve được sẽ bị xoá
 * thành chuỗi rỗng, nên khách xem mẫu sẽ thấy một tấm thiệp trống tên. Cũng
 * không dùng mode 'editor' (giữ nguyên `{{...}}`) vì đó là thứ dành cho người
 * thiết kế, không phải cho khách.
 *
 * Phải đủ 4 sự kiện: mẫu "Trọn vẹn" trỏ tới `events.0` … `events.3`, thiếu cái
 * nào là chỗ đó trống trơn khi xem thử.
 */

import type { InviteData } from '@thiepcuoi/schema';
import { SEED_KEYS } from './seed-assets';

const DEMO_DAY = '2027-03-14T07:00:00.000Z';

export function placeholderInviteData(): InviteData {
  return {
    groom: {
      fullName: 'Nguyễn Anh Tuấn', shortName: 'Anh Tuấn', birthday: '05 / 08 / 1995',
      father: 'Nguyễn Văn A', mother: 'Trần Thị B',
      address: 'Ba Đình - Hà Nội',
    },
    bride: {
      fullName: 'Lê Thị Mai Anh', shortName: 'Mai Anh', birthday: '12 / 05 / 2000',
      father: 'Lê Văn C', mother: 'Phạm Thị D',
      address: 'Hoàn Kiếm - Hà Nội',
    },
    events: [
      {
        id: 'ev-thanh-hon', title: 'Lễ thành hôn', datetime: DEMO_DAY,
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Tại tư gia nhà trai', address: 'Ba Đình - Hà Nội',
        lat: null, lng: null,
      },
      {
        id: 'ev-tiec-trai', title: 'Tiệc cưới nhà trai', datetime: '2027-03-14T02:30:00.000Z',
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Trung tâm tiệc cưới ABC', address: '123 Đường XYZ, Hà Nội',
        lat: null, lng: null,
      },
      {
        id: 'ev-tiec-gai', title: 'Tiệc cưới nhà gái', datetime: '2027-03-13T11:00:00.000Z',
        lunarText: 'Tức ngày 06 tháng 02 năm Đinh Mùi',
        venue: 'Nhà hàng Sen Vàng', address: '45 Đường MNO, Hà Nội',
        lat: null, lng: null,
      },
      {
        id: 'ev-vu-quy', title: 'Lễ vu quy', datetime: '2027-03-14T02:00:00.000Z',
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Tại tư gia nhà gái', address: 'Hoàn Kiếm - Hà Nội',
        lat: null, lng: null,
      },
    ],
    photos: {
      cover: SEED_KEYS.cover,
      couple: SEED_KEYS.couple,
      groom: SEED_KEYS.groom,
      bride: SEED_KEYS.bride,
    },
    accounts: [
      {
        id: 'acc-demo-groom', displayName: 'Chú rể', name: 'NGUYEN ANH TUAN',
        accountNumber: '0000 0000 0000', bank: 'Ngân hàng minh hoạ', qrCode: SEED_KEYS.qrGroom,
      },
      {
        id: 'acc-demo-bride', displayName: 'Cô dâu', name: 'LE THI MAI ANH',
        accountNumber: '1111 1111 1111', bank: 'Ngân hàng minh hoạ', qrCode: SEED_KEYS.qrBride,
      },
    ],
    message: 'Rất hân hạnh được đón tiếp bạn trong ngày vui của chúng mình.',
  };
}
