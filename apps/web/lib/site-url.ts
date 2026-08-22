/**
 * URL công khai của trang, dựng từ request.
 *
 * Không hằng số hoá lúc build: cùng một image chạy ở localhost, ở staging và ở
 * domain thật, mà QR in sai domain thì khách quét ra trang trắng. Đặt
 * `NEXT_PUBLIC_SITE_URL` khi đứng sau proxy không gửi `x-forwarded-*` đúng.
 */

import { headers } from 'next/headers';

export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  // Proxy đặt proto; không có thì đoán theo host: chỉ localhost mới còn dùng http
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
