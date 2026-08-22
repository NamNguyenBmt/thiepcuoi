/**
 * Xử lý ảnh: kiểm định dạng, chuẩn hoá lúc tải lên, biến đổi lúc phục vụ.
 *
 * Byte thật nằm ở đâu là việc của `blobstore.ts` (đĩa hoặc S3/R2). File này chỉ
 * làm việc với `AssetKey` dạng "uploads/<uuid>.<ext>".
 */

import sharp from 'sharp';
import { getBlobStore } from './blobstore';

/**
 * SVG không nằm trong danh sách: nó là XML có thể chứa <script>, mà file lại
 * được phục vụ từ cùng origin với trang thiệp — đúng công thức của một lỗ XSS.
 * Hoạ tiết SVG của hệ thống thì nằm trong bundle, không đi qua đường upload.
 */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Ảnh máy ảnh/điện thoại thường 4000–6000px; giữ nguyên là phí băng thông và RAM */
const MAX_DIMENSION = 3000;

/** Khoá chỉ được là uuid + đuôi đã biết — chặn "../" và mọi thứ sáng tạo khác */
const KEY_RE = /^uploads\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

export interface StoredAsset {
  id: string;
  key: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}

export interface UploadError {
  error: string;
  status: number;
}

export async function storeUpload(file: File): Promise<StoredAsset | UploadError> {
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: `Định dạng không nhận: ${file.type || 'không rõ'}`, status: 415 };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Ảnh nặng quá (tối đa ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`, status: 413 };
  }

  const input = Buffer.from(await file.arrayBuffer());

  let pipeline = sharp(input, { animated: file.type === 'image/gif' });
  let meta;
  try {
    meta = await pipeline.metadata();
  } catch {
    return { error: 'File không phải ảnh đọc được', status: 400 };
  }
  if (!meta.width || !meta.height) return { error: 'Không đọc được kích thước ảnh', status: 400 };

  // `rotate()` không tham số = áp dụng EXIF orientation rồi bỏ thẻ đó đi. Thiếu
  // bước này thì ảnh chụp dọc bằng điện thoại lên web sẽ nằm ngang.
  pipeline = pipeline.rotate();
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    pipeline = pipeline.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside' });
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true });

  const id = crypto.randomUUID();
  const key = `uploads/${id}.${EXT[file.type]}`;

  const store = await getBlobStore();
  await store.put(key, output.data, file.type);

  return {
    id,
    key,
    mime: file.type,
    width: output.info.width,
    height: output.info.height,
    bytes: output.data.length,
  };
}

export interface Transform {
  crop?: { x: number; y: number; w: number; h: number };
  resize?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  quality?: number;
}

/** Đọc tham số transform từ query — đúng bộ mà `assetUrl` của schema sinh ra */
export function parseTransform(params: URLSearchParams): Transform {
  const t: Transform = {};

  const crop = params.get('crop');
  if (crop) {
    const [x, y, w, h] = crop.split(',').map(Number);
    if ([x, y, w, h].every((v) => Number.isFinite(v) && v! >= 0) && w! > 0 && h! > 0) {
      t.crop = { x: x!, y: y!, w: w!, h: h! };
    }
  }

  const resize = params.get('resize');
  if (resize) {
    const width = Number.parseInt(resize, 10);
    if (Number.isFinite(width) && width > 0) t.resize = Math.min(width, MAX_DIMENSION);
  }

  const format = params.get('format');
  if (format === 'webp' || format === 'jpeg' || format === 'png' || format === 'auto') t.format = format;

  const quality = Number(params.get('quality'));
  if (Number.isFinite(quality) && quality >= 1 && quality <= 100) t.quality = quality;

  return t;
}

export interface RenderedImage {
  body: Buffer;
  mime: string;
}

export async function renderAsset(key: string, mime: string, t: Transform): Promise<RenderedImage> {
  const store = await getBlobStore();
  const original = await store.get(key);

  const noop = !t.crop && !t.resize && (!t.format || t.format === 'auto');
  if (noop || mime === 'image/gif') return { body: original, mime };

  let pipeline = sharp(original);
  if (t.crop) {
    pipeline = pipeline.extract({ left: t.crop.x, top: t.crop.y, width: t.crop.w, height: t.crop.h });
  }
  if (t.resize) {
    // withoutEnlargement: xin ảnh 1920 từ file gốc 800 thì trả về 800, không phóng to mờ
    pipeline = pipeline.resize({ width: t.resize, withoutEnlargement: true });
  }

  const quality = t.quality ?? 85;
  switch (t.format) {
    case 'jpeg':
      return { body: await pipeline.jpeg({ quality }).toBuffer(), mime: 'image/jpeg' };
    case 'png':
      return { body: await pipeline.png().toBuffer(), mime: 'image/png' };
    case 'webp':
    default:
      return { body: await pipeline.webp({ quality }).toBuffer(), mime: 'image/webp' };
  }
}

/** Xoá file ảnh (dùng khi có tính năng xoá asset) */
export async function removeAsset(key: string): Promise<void> {
  const store = await getBlobStore();
  await store.remove(key);
}
