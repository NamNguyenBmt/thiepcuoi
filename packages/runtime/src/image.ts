/**
 * Chọn kích thước ảnh yêu cầu CDN.
 *
 * Không yêu cầu ảnh đúng bằng px thật: mỗi bề rộng khác nhau là một biến thể
 * phải cache riêng. Làm tròn lên theo bậc để số biến thể hữu hạn.
 */

import { assetUrl } from '@thiepcuoi/schema';
import type { AssetKey, ImageTransform } from '@thiepcuoi/schema';

const STEPS = [200, 320, 480, 640, 800, 1080, 1440, 1920];

export function snapWidth(cssWidth: number, dpr: number): number {
  const target = cssWidth * Math.min(dpr, 3);
  return STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1]!;
}

export function imageUrl(
  assetBase: string,
  key: AssetKey,
  cssWidth: number,
  dpr: number,
  extra: ImageTransform = {},
): string {
  if (!key) return '';
  return assetUrl(assetBase, key, {
    resize: snapWidth(cssWidth, dpr),
    format: 'webp',
    quality: 85,
    ...extra,
  });
}

/** srcSet 1x/2x cho ảnh lớn — trình duyệt tự chọn theo màn hình thật */
export function imageSrcSet(assetBase: string, key: AssetKey, cssWidth: number): string {
  if (!key) return '';
  return [1, 2]
    .map((d) => `${imageUrl(assetBase, key, cssWidth, d)} ${d}x`)
    .join(', ');
}
