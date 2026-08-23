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
 *
 * `events` là một MẢNG, nên `events.1` nghĩa là gì hoàn toàn do mẫu quy ước —
 * và hai họ mẫu ở đây quy ước khác nhau ("Trọn vẹn" đánh số theo tiệc từng nhà,
 * "Ngọt ngào" đánh số theo buổi lễ và có thêm lễ rước dâu). Một bộ dữ liệu giả
 * dùng chung sẽ hiện đúng ở mẫu này và sai nhãn ở mẫu kia, nên chọn bộ theo
 * slug thay vì cố nhồi cả hai cách đánh số vào một mảng.
 */

import type { InviteData } from '@thiepcuoi/schema';
import { SEED_KEYS } from './seed-assets';

const DEMO_DAY = '2027-03-14T07:00:00.000Z';

/** Bộ dữ liệu giả hợp với mẫu đang xem thử */
export function placeholderFor(templateSlug: string): InviteData {
  return templateSlug.startsWith('ngot-ngao') ? sweetPlaceholderData() : placeholderInviteData();
}

/**
 * Thứ tự sự kiện của mẫu "Ngọt ngào":
 *   0 = tiệc vu quy (nhà gái), 1 = tiệc thành hôn (nhà trai), 2 = lễ rước dâu
 */
function sweetPlaceholderData(): InviteData {
  return {
    ...placeholderInviteData(),
    events: [
      {
        id: 'ev-vu-quy', title: 'Lễ vu quy', datetime: '2027-03-13T04:00:00.000Z',
        lunarText: 'Tức ngày 06 tháng 02 năm Đinh Mùi',
        venue: 'Nhà hàng Sen Vàng', address: '45 Đường MNO, Hà Nội',
        lat: null, lng: null,
      },
      {
        id: 'ev-thanh-hon', title: 'Lễ thành hôn', datetime: '2027-03-15T04:00:00.000Z',
        lunarText: 'Tức ngày 08 tháng 02 năm Đinh Mùi',
        venue: 'Trung tâm tiệc cưới ABC', address: '123 Đường XYZ, Hà Nội',
        lat: null, lng: null,
      },
      {
        id: 'ev-ruoc-dau', title: 'Lễ rước dâu', datetime: DEMO_DAY,
        lunarText: 'Tức ngày 07 tháng 02 năm Đinh Mùi',
        venue: 'Tại tư gia nhà gái', address: 'Hoàn Kiếm - Hà Nội',
        lat: null, lng: null,
      },
    ],
  };
}

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
      // Trang xem thử mẫu cần đủ hình; thiệp thật chưa có QR thì chỗ đó bỏ trống
      qrGroom: SEED_KEYS.qrGroom,
      qrBride: SEED_KEYS.qrBride,
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
