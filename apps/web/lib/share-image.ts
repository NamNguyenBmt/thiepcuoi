/**
 * Ảnh xem trước khi gửi link thiệp qua Zalo, Messenger, Facebook.
 *
 * Không có `og:image` thì link gửi đi chỉ là một dòng chữ — mà tấm thiệp cưới
 * được chia sẻ chính là để người nhận thấy ảnh cô dâu chú rể trước khi bấm.
 *
 * Cắt sẵn ở server chứ không để nền tảng tự cắt: ảnh cưới phần lớn chụp dọc,
 * còn khung xem trước thì ngang, và nền tảng cắt ở chính giữa — đúng chỗ ngang
 * ngực, đầu hai người nằm ngoài khung.
 *
 * Phục vụ qua đường dẫn "sạch" `/thiep/<slug>/anh/<uuid>.jpg` thay vì
 * `/api/assets/...?crop=...&format=jpeg`: với URL có query, Zalo lấy được tiêu
 * đề mà để trống ảnh, trong khi ảnh vẫn tải bình thường. Các trang thiệp khác
 * hiện được ảnh trên Zalo đều dùng đường dẫn kết thúc bằng `.jpg`.
 */

import type { InviteData } from '@thiepcuoi/schema';

/** Tỉ lệ Facebook/Zalo khuyến nghị cho ảnh lớn */
export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 628;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/**
 * Chọn ảnh: `share` nếu chủ thiệp đặt riêng, không thì ảnh bìa, không thì ảnh
 * đầu tiên có trong thiệp.
 */
export function pickShareKey(photos: InviteData['photos']): string | null {
  return photos.share || photos.cover || Object.values(photos).find(Boolean) || null;
}

/**
 * Vùng cắt ngang từ ảnh gốc. Ảnh dọc lấy dải quanh 35% chiều cao — mặt người
 * trong ảnh chụp đứng thường nằm ở phần ba phía trên. Ảnh vốn đã ngang thì lấy
 * chính giữa.
 */
export function shareCrop(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const ratio = SHARE_WIDTH / SHARE_HEIGHT;
  if (width / height > ratio) {
    const w = Math.round(height * ratio);
    return { x: Math.round((width - w) / 2), y: 0, w, h: height };
  }
  const h = Math.round(width / ratio);
  const center = height >= width ? height * 0.35 : height / 2;
  const y = Math.round(Math.min(Math.max(center - h / 2, 0), height - h));
  return { x: 0, y, w: width, h };
}

/**
 * Đường dẫn ảnh xem trước. Mang uuid của ảnh nên đổi ảnh bìa là đổi URL — cache
 * vĩnh viễn được mà không sợ nền tảng giữ ảnh cũ.
 */
export function sharePath(slug: string, key: string): string | null {
  const id = key.match(UUID_RE)?.[0];
  return id ? `/thiep/${encodeURIComponent(slug)}/anh/${id}.jpg` : null;
}

/**
 * Ngược lại từ tên file về asset key — chỉ nhận ảnh đang nằm trong chính thiệp
 * đó, để đường dẫn này không thành cửa đọc ảnh bất kỳ trong kho.
 */
export function shareKeyForFile(photos: InviteData['photos'], file: string): string | null {
  const id = file.match(/^([0-9a-f-]{36})\.jpg$/)?.[1];
  if (!id) return null;
  return Object.values(photos).find((k) => k && k.split('?')[0]!.match(UUID_RE)?.[0] === id)?.split('?')[0] ?? null;
}
