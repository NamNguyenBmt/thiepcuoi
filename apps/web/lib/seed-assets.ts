/**
 * Ảnh mồi cho mẫu thiệp.
 *
 * Không tải ảnh từ internet lúc seed: container phải chạy được trong mạng kín,
 * và một mẫu thiệp phụ thuộc vào máy chủ ảnh của người khác là thứ sẽ hỏng vào
 * đúng lúc không ai để ý. Ở đây `sharp` rasterise SVG sinh tại chỗ, ra JPEG
 * thật, đi qua đúng đường lưu trữ như ảnh người dùng tải lên.
 *
 * Chủ ảnh cưới thật thì thay bằng cách tải ảnh trong `/quan-ly` — key trong
 * `InviteData.photos` đổi theo, template không phải sửa.
 */

import sharp from 'sharp';
import { getBlobStore } from './blobstore';
import type { AssetRow } from './db';

export interface SeedAsset {
  row: Omit<AssetRow, 'createdAt'>;
  key: string;
}

/** Bảng màu dùng chung với mẫu — xem seed-template.ts */
const WINE = '#7a2c2c';
const ROSE = '#c98b8b';
const CREAM = '#fdf6f4';

/**
 * SVG là XML: một dấu "&" trong chữ lồng đủ làm sharp bỏ cả file.
 * (Đúng như vậy — "Q&V" là thứ đã làm hỏng lần chạy đầu.)
 */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ảnh giả nhưng không phải ô xám trống: chữ lồng, khung mảnh và dải màu đủ để
 * nhìn ra bố cục thật khi xem thử, mà vẫn rõ ràng là chỗ chờ thay ảnh.
 */
function portraitSvg(w: number, h: number, label: string, monogram: string): string {
  const cx = w / 2;
  const cy = h / 2;
  const ring = Math.min(w, h) * 0.28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${CREAM}"/>
      <stop offset="55%" stop-color="#f3dcd8"/>
      <stop offset="100%" stop-color="${ROSE}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy - h * 0.04}" r="${ring}" fill="none" stroke="${WINE}" stroke-opacity="0.28" stroke-width="${Math.max(1, w * 0.004)}"/>
  ${monogram ? `<text x="${cx}" y="${cy + ring * 0.18}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${ring * 0.85}"
        fill="${WINE}" fill-opacity="0.55">${esc(monogram)}</text>` : ''}
  <text x="${cx}" y="${h - h * 0.07}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="${w * 0.045}"
        letter-spacing="${w * 0.012}" fill="${WINE}" fill-opacity="0.7">${esc(label)}</text>
</svg>`;
}

/**
 * QR giả: lưới ô vuông tất định (không random) nên ảnh seed của hai lần chạy
 * là một. Máy quét sẽ không đọc ra gì — đúng như mong đợi, đây là chỗ chờ dán
 * QR ngân hàng thật.
 */
function qrSvg(size: number, label: string): string {
  const cells = 21;
  const cell = size / (cells + 4);
  const off = cell * 2;
  const rects: string[] = [];

  const finder = (gx: number, gy: number) => {
    rects.push(
      `<rect x="${off + gx * cell}" y="${off + gy * cell}" width="${cell * 7}" height="${cell * 7}" fill="${WINE}"/>`,
      `<rect x="${off + (gx + 1) * cell}" y="${off + (gy + 1) * cell}" width="${cell * 5}" height="${cell * 5}" fill="#ffffff"/>`,
      `<rect x="${off + (gx + 2) * cell}" y="${off + (gy + 2) * cell}" width="${cell * 3}" height="${cell * 3}" fill="${WINE}"/>`,
    );
  };
  finder(0, 0);
  finder(cells - 7, 0);
  finder(0, cells - 7);

  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= cells - 8 && y < 8) || (x < 8 && y >= cells - 8);

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (inFinder(x, y)) continue;
      // Tất định: nhìn ngẫu nhiên nhưng luôn ra cùng một hình
      if (((x * 7 + y * 13 + ((x * y) % 5)) & 3) !== 0) continue;
      rects.push(
        `<rect x="${off + x * cell}" y="${off + y * cell}" width="${cell}" height="${cell}" fill="${WINE}"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + cell * 3}" viewBox="0 0 ${size} ${size + cell * 3}">
  <rect width="${size}" height="${size + cell * 3}" fill="#ffffff"/>
  ${rects.join('')}
  <text x="${size / 2}" y="${size + cell * 2}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="${cell * 1.6}" fill="${WINE}">${esc(label)}</text>
</svg>`;
}

/** Icon tròn cho nút mừng cưới */
function giftIconSvg(size: number): string {
  const c = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${c}" cy="${c}" r="${c}" fill="${WINE}"/>
  <rect x="${size * 0.24}" y="${size * 0.42}" width="${size * 0.52}" height="${size * 0.34}" rx="${size * 0.04}" fill="${CREAM}"/>
  <rect x="${size * 0.2}" y="${size * 0.34}" width="${size * 0.6}" height="${size * 0.12}" rx="${size * 0.03}" fill="#ffffff"/>
  <rect x="${size * 0.46}" y="${size * 0.34}" width="${size * 0.08}" height="${size * 0.42}" fill="${ROSE}"/>
  <path d="M ${c} ${size * 0.35} q ${-size * 0.14} ${-size * 0.16} ${-size * 0.02} ${-size * 0.2}
           q ${size * 0.09} ${-size * 0.03} ${size * 0.02} ${size * 0.2} z" fill="#ffffff"/>
  <path d="M ${c} ${size * 0.35} q ${size * 0.14} ${-size * 0.16} ${size * 0.02} ${-size * 0.2}
           q ${-size * 0.09} ${-size * 0.03} ${-size * 0.02} ${size * 0.2} z" fill="#ffffff"/>
</svg>`;
}

interface Spec {
  id: string;
  svg: string;
  name: string;
  mime: 'image/jpeg' | 'image/png';
}

/**
 * Id cố định thay vì uuid ngẫu nhiên: seed chạy lại phải ra đúng khoá cũ, nếu
 * không mỗi lần dựng lại database là template trỏ vào ảnh không còn tồn tại.
 * Vẫn khớp `isValidKey` vì đúng dạng 36 ký tự hex-và-gạch.
 */
const FIXED_ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function specs(): Spec[] {
  const list: Spec[] = [
    { id: FIXED_ID(1), svg: portraitSvg(1000, 1500, 'ẢNH BÌA', ''), name: 'placeholder-bia.jpg', mime: 'image/jpeg' },
    { id: FIXED_ID(2), svg: portraitSvg(900, 1200, 'ẢNH ĐÔI', ''), name: 'placeholder-doi.jpg', mime: 'image/jpeg' },
    { id: FIXED_ID(3), svg: portraitSvg(900, 1200, 'CHÚ RỂ', ''), name: 'placeholder-chu-re.jpg', mime: 'image/jpeg' },
    { id: FIXED_ID(4), svg: portraitSvg(900, 1200, 'CÔ DÂU', ''), name: 'placeholder-co-dau.jpg', mime: 'image/jpeg' },
  ];
  for (let i = 1; i <= 4; i++) {
    list.push({
      id: FIXED_ID(10 + i),
      svg: portraitSvg(900, 1150, `ẢNH ${i}`, ''),
      name: `placeholder-album-${i}.jpg`,
      mime: 'image/jpeg',
    });
  }
  list.push(
    { id: FIXED_ID(21), svg: qrSvg(600, 'CHÚ RỂ'), name: 'placeholder-qr-chu-re.png', mime: 'image/png' },
    { id: FIXED_ID(22), svg: qrSvg(600, 'CÔ DÂU'), name: 'placeholder-qr-co-dau.png', mime: 'image/png' },
    { id: FIXED_ID(23), svg: giftIconSvg(200), name: 'placeholder-icon-qua.png', mime: 'image/png' },
  );
  return list;
}

/** Khoá ổn định để template và InviteData tham chiếu tới */
export const SEED_KEYS = {
  cover: `uploads/${FIXED_ID(1)}.jpg`,
  couple: `uploads/${FIXED_ID(2)}.jpg`,
  groom: `uploads/${FIXED_ID(3)}.jpg`,
  bride: `uploads/${FIXED_ID(4)}.jpg`,
  album: [1, 2, 3, 4].map((i) => `uploads/${FIXED_ID(10 + i)}.jpg`),
  qrGroom: `uploads/${FIXED_ID(21)}.png`,
  qrBride: `uploads/${FIXED_ID(22)}.png`,
  giftIcon: `uploads/${FIXED_ID(23)}.png`,
} as const;

/**
 * Sinh ảnh và ghi vào kho blob. Trả về hàng để chèn vào bảng `assets` —
 * thiếu hàng này thì `/api/assets/...` trả 404 dù byte đã nằm trong kho.
 */
export async function buildSeedAssets(ownerId: string): Promise<SeedAsset[]> {
  const store = await getBlobStore();
  const out: SeedAsset[] = [];

  for (const spec of specs()) {
    const ext = spec.mime === 'image/png' ? 'png' : 'jpg';
    const key = `uploads/${spec.id}.${ext}`;

    const pipeline = sharp(Buffer.from(spec.svg));
    const buf =
      spec.mime === 'image/png'
        ? await pipeline.png().toBuffer({ resolveWithObject: true })
        : await pipeline.jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });

    await store.put(key, buf.data, spec.mime);

    out.push({
      key,
      row: {
        id: spec.id,
        key,
        ownerId,
        mime: spec.mime,
        width: buf.info.width,
        height: buf.info.height,
        bytes: buf.data.length,
        originalName: spec.name,
      },
    });
  }

  return out;
}
