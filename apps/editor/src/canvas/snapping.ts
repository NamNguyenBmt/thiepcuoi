/**
 * Bắt dính (snap) khi kéo node.
 *
 * So 3 mốc ngang (trái / giữa / phải) và 3 mốc dọc (trên / giữa / dưới) của
 * node đang kéo với các node khác cùng section, cộng thêm trục giữa canvas.
 * Ngưỡng tính bằng px canvas — chỗ gọi phải chia cho zoom trước.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: 'x' | 'y';
  /** Toạ độ canvas của đường gióng */
  at: number;
  /** Đoạn cần vẽ, để đường gióng chỉ dài bằng vùng liên quan */
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const marks = (r: Rect) => ({
  x: [r.left, r.left + r.width / 2, r.left + r.width],
  y: [r.top, r.top + r.height / 2, r.top + r.height],
});

export function snap(moving: Rect, others: Rect[], canvasWidth: number, threshold: number): SnapResult {
  const m = marks(moving);
  const guides: Guide[] = [];

  let bestX: { delta: number; at: number; dist: number } | null = null;
  let bestY: { delta: number; at: number; dist: number } | null = null;

  const targetsX: number[] = [canvasWidth / 2];
  const targetsY: number[] = [];
  for (const o of others) {
    const om = marks(o);
    targetsX.push(...om.x);
    targetsY.push(...om.y);
  }

  for (const mark of m.x) {
    for (const t of targetsX) {
      const dist = Math.abs(t - mark);
      if (dist <= threshold && (!bestX || dist < bestX.dist)) {
        bestX = { delta: t - mark, at: t, dist };
      }
    }
  }
  for (const mark of m.y) {
    for (const t of targetsY) {
      const dist = Math.abs(t - mark);
      if (dist <= threshold && (!bestY || dist < bestY.dist)) {
        bestY = { delta: t - mark, at: t, dist };
      }
    }
  }

  if (bestX) {
    guides.push({ axis: 'x', at: bestX.at, from: moving.top - 40, to: moving.top + moving.height + 40 });
  }
  if (bestY) {
    guides.push({ axis: 'y', at: bestY.at, from: moving.left - 40, to: moving.left + moving.width + 40 });
  }

  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides };
}

/** Khung bao của nhiều node — dùng khi chọn nhiều */
export function boundingRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}
