/**
 * Ảnh xem trước khi gửi link thiệp qua Zalo, Messenger, Facebook.
 *
 * Không có `og:image` thì link gửi đi chỉ là một dòng chữ — mà tấm thiệp cưới
 * được chia sẻ chính là để người nhận thấy ảnh cô dâu chú rể trước khi bấm.
 *
 * Cắt sẵn ở server chứ không để nền tảng tự cắt: ảnh cưới phần lớn chụp dọc,
 * còn khung xem trước thì ngang, và nền tảng cắt ở chính giữa — đúng chỗ ngang
 * ngực, đầu hai người nằm ngoài khung.
 */

import { assetUrl } from '@thiepcuoi/schema';
import type { InviteData } from '@thiepcuoi/schema';

/** Tỉ lệ Facebook/Zalo khuyến nghị cho ảnh lớn */
export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 628;

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
 * URL tuyệt đối — trình thu thập của các nền tảng không hiểu đường dẫn tương đối.
 * Không biết kích thước ảnh gốc thì bỏ cắt, để nền tảng tự xử.
 */
export function shareImageUrl(
  origin: string,
  assetBase: string,
  key: string,
  size: { width: number; height: number } | null,
): string {
  const base = /^https?:\/\//.test(assetBase) ? assetBase : `${origin}${assetBase}`;
  const crop = size && size.width > 0 && size.height > 0 ? shareCrop(size.width, size.height) : undefined;
  return assetUrl(base, key.split('?')[0]!, { crop, resize: SHARE_WIDTH, format: 'jpeg', quality: 85 });
}
