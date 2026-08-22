/**
 * Giới hạn tần suất, giữ trong bộ nhớ tiến trình.
 *
 * Đủ cho một tiến trình; chạy nhiều instance thì cần Redis. Nhưng "chưa hoàn
 * hảo" vẫn hơn hẳn "không có gì": không có nó thì form đăng nhập cho phép thử
 * mật khẩu vô hạn với tốc độ mạng.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Còn bao nhiêu lượt trong cửa sổ hiện tại */
  remaining: number;
  /** Giây phải chờ, chỉ có nghĩa khi ok = false */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0]!;
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Dọn định kỳ để Map không phình vô hạn theo số IP đã từng gọi
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: limit - bucket.hits.length, retryAfter: 0 };
}

/** Khoá theo IP. Sau proxy thì tin x-forwarded-for; tự host thẳng thì không có header này. */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${prefix}:${forwarded || 'local'}`;
}

/** Chỉ dùng trong test để bắt đầu lại từ trạng thái sạch */
export function resetRateLimits(): void {
  buckets.clear();
}
