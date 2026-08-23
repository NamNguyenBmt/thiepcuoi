/**
 * Trường dẫn xuất cho token binding.
 *
 * Thiệp cưới lúc nào cũng cần một ngày viết ra ba bốn kiểu: "14 . 03 . 2027",
 * "Chủ nhật - 14 : 00", "Tháng 3". Bắt người dùng nhập lại từng kiểu là mời
 * họ nhập lệch nhau; bắt designer nhúng định dạng vào template thì mỗi mẫu
 * lại tự chế một kiểu. Nên `datetime` vẫn là nguồn duy nhất, còn các biến thể
 * chữ được sinh ra ở đây ngay trước khi resolve token.
 *
 * Không đụng tới `InviteData` lưu trong database: đây là lớp phủ lúc render.
 */

import type { InviteData } from './types';

/** Thiệp cưới ở Việt Nam — giờ hiển thị phải là giờ Việt Nam bất kể máy ai mở */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

interface Parts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  weekday: number;
}

/**
 * Tách các thành phần theo múi giờ Việt Nam.
 *
 * Dùng `Intl` thay vì cộng trừ 7 tiếng bằng tay: kết quả giống nhau ở server
 * và ở trình duyệt của khách, nên không có hydration mismatch.
 */
function partsOf(iso: string): Parts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  });

  const found: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) found[p.type] = p.value;

  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(found.weekday ?? '');

  return {
    day: found.day ?? '',
    month: found.month ?? '',
    year: found.year ?? '',
    // 24:00 là cách Intl viết nửa đêm ở một số môi trường
    hour: found.hour === '24' ? '00' : (found.hour ?? ''),
    minute: found.minute ?? '',
    weekday: weekdayIndex < 0 ? 0 : weekdayIndex,
  };
}

export interface DerivedEventFields {
  /** "14 . 03 . 2027" */
  dateText: string;
  /**
   * "14/03" — bản gọn cho những chỗ chật.
   *
   * Một tấm thiệp có nhiều buổi thì danh sách trình tự sẽ có hai dòng cùng giờ
   * ("11 : 00" hai lần), và khách không biết dòng nào của ngày nào. Ghép sẵn
   * ngày/tháng ở đây thay vì bắt mỗi mẫu tự nối `day` với `monthText` —
   * "27/Tháng 9" là thứ sẽ ra nếu làm vậy.
   */
  dayMonth: string;
  /** "Chủ nhật - 14 : 00" */
  weekdayTime: string;
  /** "Chủ nhật" */
  weekday: string;
  /** "14 : 00" */
  time: string;
  /** "14" */
  day: string;
  /** "Tháng 3" */
  monthText: string;
  /** "2027" */
  year: string;
}

function deriveEvent(datetime: string): DerivedEventFields {
  const p = partsOf(datetime);
  if (!p) {
    return { dateText: '', dayMonth: '', weekdayTime: '', weekday: '', time: '', day: '', monthText: '', year: '' };
  }
  const weekday = WEEKDAYS[p.weekday] ?? '';
  const time = `${p.hour} : ${p.minute}`;
  return {
    dateText: `${p.day} . ${p.month} . ${p.year}`,
    dayMonth: `${p.day}/${p.month}`,
    weekdayTime: `${weekday} - ${time}`,
    weekday,
    time,
    day: p.day,
    monthText: `Tháng ${Number(p.month)}`,
    year: p.year,
  };
}

/**
 * Bản `InviteData` đã gắn thêm trường chữ cho từng sự kiện.
 *
 * Trả về `null` khi không có dữ liệu để chỗ gọi khỏi phải kiểm hai lần.
 */
export function deriveInviteData(data: InviteData | null): InviteData | null {
  if (!data) return null;
  // `InviteData` đọc từ cột JSON, và editor còn dựng bản rút gọn để xem thử —
  // không có gì bảo đảm `events` tồn tại. Kiểu nói là mảng, thực tế thì chưa chắc.
  if (!Array.isArray(data.events)) return data;
  return {
    ...data,
    events: data.events.map((ev) => ({ ...ev, ...deriveEvent(ev.datetime) })),
  };
}
