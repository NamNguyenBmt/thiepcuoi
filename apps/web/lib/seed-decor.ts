/**
 * Hoạ tiết trang trí cho mẫu thiệp.
 *
 * Vẽ bằng SVG rồi rasterise sang PNG lúc seed, cùng đường đi với ảnh người dùng
 * tải lên (xem `seed-assets.ts`). Ba lý do không dùng file PNG dựng sẵn trong
 * repo:
 *   - hình vẽ ở đây là code, sửa màu bảng thiệp là sửa một hằng số;
 *   - `sharp` xuất đúng độ phân giải cần, không ai phải nhớ export lại @2x;
 *   - repo không phình lên vì mấy trăm KB ảnh nhị phân.
 *
 * Không có <text> trong bất kỳ hình nào: `sharp` phụ thuộc fontconfig của máy
 * chạy, mà container thì không cài font — chữ sẽ biến mất trên production mà
 * chạy ở máy dev vẫn thấy đẹp. Chữ 囍 cũng vì vậy mà dựng bằng hình khối.
 */

/** Bảng màu của mẫu "Ngọt ngào" — trùng với seed-template-42.ts */
const ROSE = '#e49696';
const BLUSH = '#dfbaba';
const SEAL = '#a3403d';

/** Trái tim trong ô 100×100, dùng lại cho tim rơi, tim mốc lịch, tim mốc giờ */
const HEART_PATH =
  'M50 92C22 72 4 55 4 34.5 4 18 17 6 32 6c9.5 0 17 4.6 18 12 1-7.4 8.5-12 18-12 15 0 28 12 28 28.5C96 55 78 72 50 92z';

/**
 * Vòng tròn pastel + ba tia lấp lánh, đặt trước các tiêu đề "About us".
 * Tỉ lệ 1.25 giữ đúng khung mà mẫu dùng (61.7 × 49.4).
 */
export function sparkleCircleSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" viewBox="0 0 250 200">
  <defs>
    <linearGradient id="c" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#d99b95" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#eec4bd" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3c4b6"/>
      <stop offset="100%" stop-color="#e8a293"/>
    </linearGradient>
  </defs>
  <circle cx="88" cy="105" r="86" fill="url(#c)"/>
  <path d="M196 8c4 26 10 32 36 36-26 4-32 10-36 36-4-26-10-32-36-36 26-4 32-10 36-36z" fill="url(#s)"/>
  <path d="M150 52c2.6 16 6 20 22 22-16 2.6-19.4 6-22 22-2.6-16-6-19.4-22-22 16-2 19.4-6 22-22z" fill="url(#s)"/>
  <circle cx="152" cy="14" r="5" fill="url(#s)"/>
  <circle cx="238" cy="82" r="4" fill="url(#s)"/>
</svg>`;
}

/** Ba trái tim bay, đặt cạnh khối chữ "YES! I DO" */
export function floatingHeartsSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 300 200">
  <defs>
    <linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f28b90"/>
      <stop offset="70%" stop-color="#f8c9c9" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <g fill="url(#h)">
    <g transform="translate(120 4) rotate(12) scale(1.15)"><path d="${HEART_PATH}"/></g>
    <g transform="translate(0 118) rotate(-8) scale(0.42)"><path d="${HEART_PATH}"/></g>
    <g transform="translate(222 128) rotate(16) scale(0.66)"><path d="${HEART_PATH}"/></g>
  </g>
</svg>`;
}

/** Trái tim đặc — mốc ngày trên lịch và chấm mốc giờ ở phần trình tự buổi lễ */
export function heartSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
  <path d="${HEART_PATH}" fill="${color}"/>
</svg>`;
}

/**
 * Dấu 囍 (song hỷ) trên nền triện tròn.
 *
 * 囍 là hai chữ 喜 đứng cạnh nhau, mà 喜 thì toàn nét thẳng — dựng lại bằng
 * hình chữ nhật ra đúng chữ, không cần font CJK.
 */
export function doubleHappinessSvg(): string {
  const hi = (dx: number) => `
    <rect x="${dx + 4}" y="10" width="38" height="5"/>
    <rect x="${dx + 20}" y="10" width="6" height="12"/>
    <rect x="${dx + 10}" y="22" width="26" height="5"/>
    <path d="M${dx + 11} 32h24v14h-24z" fill="none" stroke="${SEAL}" stroke-width="5"/>
    <rect x="${dx + 1}" y="52" width="44" height="5"/>
    <rect x="${dx + 15}" y="57" width="16" height="5"/>
    <path d="M${dx + 6} 66h34v18h-34z" fill="none" stroke="${SEAL}" stroke-width="5"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 130 130">
  <circle cx="65" cy="65" r="62" fill="none" stroke="${SEAL}" stroke-width="4"/>
  <circle cx="65" cy="65" r="55" fill="none" stroke="${SEAL}" stroke-width="1.5"/>
  <g fill="${SEAL}" transform="translate(19 22)">${hi(0)}${hi(46)}</g>
</svg>`;
}

/** Xe hoa — mốc "Lễ rước dâu" */
export function weddingCarSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 120 120">
  <g>
    <path d="M14 78c-4 0-6-3-6-7l1-9c0-4 3-7 7-8l17-3 14-13c3-3 7-4 11-4h19c5 0 9 3 11 7l7 13 12 3c5 1 8 5 8 10v4c0 4-3 7-7 7z"
          fill="#ef9c9c"/>
    <path d="M52 38h16c3 0 5 1 7 4l6 10H49z" fill="#cfe8e6"/>
    <path d="M40 44l-9 8h14V40z" fill="#cfe8e6"/>
    <rect x="8" y="70" width="14" height="7" rx="3" fill="#fdf3e3"/>
    <rect x="98" y="70" width="14" height="7" rx="3" fill="#fdf3e3"/>
    <circle cx="34" cy="80" r="13" fill="#5f5f66"/>
    <circle cx="34" cy="80" r="5" fill="#dcdce0"/>
    <circle cx="88" cy="80" r="13" fill="#5f5f66"/>
    <circle cx="88" cy="80" r="5" fill="#dcdce0"/>
    <path d="M61 48c-5-3-10-1-10 3s5 5 10 3c5 2 10 1 10-3s-5-6-10-3z" fill="#fde7ea"/>
    <path d="M61 54l-3 12h6z" fill="#fde7ea"/>
    <g>
      <circle cx="30" cy="49" r="7" fill="#f2777f"/>
      <circle cx="42" cy="45" r="6" fill="#f7b1b6"/>
      <circle cx="20" cy="53" r="5.5" fill="#f7d9a0"/>
      <circle cx="35" cy="41" r="5" fill="#fbe3e5"/>
      <path d="M46 52c5-4 10-4 13-1-4 4-9 5-13 1z" fill="#7fa887"/>
      <path d="M16 45c-4-4-4-9-1-12 4 4 5 8 1 12z" fill="#7fa887"/>
    </g>
  </g>
</svg>`;
}

/** Hai ly champagne thắt nơ — mốc "Khai tiệc" */
export function champagneSvg(): string {
  const flute = (dx: number, bow: string) => `
    <g transform="translate(${dx} 0)">
      <path d="M18 14h30l-3 26c-1 8-5 12-12 12s-11-4-12-12z" fill="#f6c0b8"/>
      <path d="M18 14h30l-1 8H19z" fill="#f3ada4"/>
      <rect x="31" y="52" width="4" height="30" fill="#f0b3ad"/>
      <ellipse cx="33" cy="84" rx="14" ry="4" fill="#efaea7"/>
      <circle cx="28" cy="30" r="3" fill="#fdeae7" opacity="0.9"/>
      <circle cx="37" cy="24" r="2" fill="#fdeae7" opacity="0.9"/>
      <circle cx="35" cy="38" r="4.5" fill="#fdeae7" opacity="0.75"/>
      <g fill="${bow}">
        <path d="M33 60c-5-7-14-6-14 0s9 7 14 0z"/>
        <path d="M33 60c5-7 14-6 14 0s-9 7-14 0z"/>
        <circle cx="33" cy="60" r="4"/>
        <path d="M30 64c-3 5-1 8-3 12h3c2-4 1-8 3-12z"/>
        <path d="M36 64c3 5 1 8 3 12h-3c-2-4-1-8-3-12z"/>
      </g>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 120 120">
  <g transform="translate(-8 14)">${flute(0, '#f2cf7f')}${flute(52, '#82b0dd')}</g>
</svg>`;
}

/** Hai bàn tay ôm trái tim — mốc "Chụp hình lưu niệm" */
export function handsHeartSvg(): string {
  const hand = `
    <path d="M6 96V52c0-6 4-10 9-10 5 0 8 4 8 9V34c0-6 4-10 9-10 5 0 8 4 8 10 0-7 4-11 9-11 5 0 8 4 8 10v10c0-6 4-9 8-9 5 0 8 4 8 10v14c0 12-8 18-16 20-6 2-9 6-9 12v6z"
          fill="#fde3cc" stroke="#f79267" stroke-width="4" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 120 120">
  <g transform="translate(2 12) scale(0.5)">${hand}</g>
  <g transform="translate(118 12) scale(-0.5 0.5)">${hand}</g>
  <g transform="translate(38 34) scale(0.44)">
    <path d="${HEART_PATH}" fill="#ef8f96" stroke="#c9535e" stroke-width="7"/>
  </g>
</svg>`;
}

/** Cô dâu chú rể — hình kết ở cuối thiệp */
export function coupleFigureSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 180 180">
  <g>
    <path d="M6 160c0-30 12-52 30-58l8-3 8 3c18 6 30 28 30 58z" fill="#fdfcfb"/>
    <path d="M6 160c0-30 12-52 30-58 4 12 5 38 4 58z" fill="#f2eeec"/>
    <rect x="36" y="86" width="16" height="20" rx="7" fill="#fdfcfb"/>
    <circle cx="44" cy="74" r="16" fill="#f7d9c4"/>
    <path d="M28 72c0-12 7-19 16-19s16 7 16 19c-4-6-10-8-16-8s-12 2-16 8z" fill="#4a3730"/>
    <path d="M60 60c6-4 12-2 13 3-5-1-9 0-13-3z" fill="#f7f2ef"/>
    <path d="M28 66c-6-2-9-8-6-12 4 3 6 7 6 12z" fill="#4a3730"/>
  </g>
  <g>
    <path d="M112 160v-52h40v52z" fill="#2f2f38"/>
    <path d="M128 106h8v54h-8z" fill="#22222a"/>
    <path d="M116 106c-4-14 0-24 8-28l8 12 8-12c8 4 12 14 8 28z" fill="#2f2f38"/>
    <path d="M124 78h16l-8 12z" fill="#ffffff"/>
    <path d="M126 90h12l-6 8z" fill="#c25b63"/>
    <circle cx="132" cy="66" r="15" fill="#f7d9c4"/>
    <path d="M117 62c0-10 7-16 15-16s15 6 15 16c-5-5-9-7-15-7s-10 2-15 7z" fill="#33261f"/>
    <path d="M104 116c-6 4-8 12-6 18l6-2z" fill="#2f2f38"/>
  </g>
  <g transform="translate(76 96) scale(0.3)">
    <path d="${HEART_PATH}" fill="${ROSE}"/>
  </g>
</svg>`;
}

/**
 * Đường viền mềm, gợn sóng — mép sáp chảy ra rồi đông lại.
 *
 * Nối các điểm bằng đường bậc hai đi qua trung điểm hai cạnh kề: cách này cho
 * đường cong khép kín liền mạch, không có góc nhọn ở chỗ nối. Một vòng tròn
 * đều tăm tắp trông như cái nút áo chứ không ra dấu xi.
 */
function blobPath(cx: number, cy: number, r: number, bumps: number, amp: number, seed = 1): string {
  const pts: Array<[number, number]> = [];
  const n = bumps * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Nhiễu tất định: mỗi lần dựng ra đúng một hình, không nhấp nháy giữa các lần seed
    const jitter = Math.sin(i * 12.9898 * seed) * 0.5 + 0.5;
    const rr = r + (i % 2 === 0 ? amp * (0.6 + jitter * 0.8) : -amp * (0.3 + jitter * 0.5));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const mid = (a: [number, number], b: [number, number]) =>
    `${((a[0] + b[0]) / 2).toFixed(2)} ${((a[1] + b[1]) / 2).toFixed(2)}`;

  let d = `M ${mid(pts[n - 1]!, pts[0]!)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    d += ` Q ${p[0].toFixed(2)} ${p[1].toFixed(2)} ${mid(p, pts[(i + 1) % n]!)}`;
  }
  return d + ' Z';
}

/**
 * Dấu xi gắn giữa nắp bì thư.
 *
 * Ba lớp làm nên cảm giác sáp: khối sáp mép gợn sóng, một vòng lõm do con dấu
 * ấn xuống, và trái tim nổi ở giữa. Trái tim vẽ hai lần — bản tối lệch xuống
 * làm bóng đổ trong lòng vết ấn, bản sáng nằm trên — vì một hình phẳng một màu
 * thì nhìn như sticker dán lên chứ không phải vết dấu ấn vào sáp.
 */
export function waxSealSvg(): string {
  const outer = blobPath(50, 50, 42, 13, 4.2, 1);
  const inner = blobPath(50, 50, 31, 11, 2.0, 2.7);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="wax" cx="0.34" cy="0.28" r="0.85">
      <stop offset="0%" stop-color="#e9cd93"/>
      <stop offset="42%" stop-color="#c9a35c"/>
      <stop offset="78%" stop-color="#a07c3a"/>
      <stop offset="100%" stop-color="#6f5222"/>
    </radialGradient>
    <radialGradient id="dish" cx="0.5" cy="0.42" r="0.7">
      <stop offset="0%" stop-color="#a8843f"/>
      <stop offset="100%" stop-color="#c8a45e"/>
    </radialGradient>
    <filter id="soft" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
  </defs>

  <path d="${outer}" fill="#4a3616" opacity="0.35" transform="translate(1.4 2.2)" filter="url(#soft)"/>
  <path d="${outer}" fill="url(#wax)"/>
  <path d="${inner}" fill="url(#dish)"/>
  <path d="${inner}" fill="none" stroke="#7a5c28" stroke-width="0.9" opacity="0.55"/>

  <g transform="translate(31 30) scale(0.38)">
    <path d="${HEART_PATH}" fill="#6b4f20" opacity="0.85" transform="translate(0 4)"/>
    <path d="${HEART_PATH}" fill="#dfbe83"/>
  </g>

  <path d="M28 26q10-9 24-7" fill="none" stroke="#f0dcae" stroke-width="2.6"
        stroke-linecap="round" opacity="0.45"/>
</svg>`;
}

/** Vòng tròn nét đứt sau ảnh cô dâu / chú rể ở phần mừng cưới */
export function dashedRingSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="94" fill="none" stroke="${BLUSH}"
          stroke-width="9" stroke-linecap="round" stroke-dasharray="20 16"/>
</svg>`;
}

/** Mask tròn cho PhotoProps.maskShapeImg — trắng đặc = phần ảnh giữ lại */
export function circleMaskSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="100" fill="#ffffff"/>
</svg>`;
}
