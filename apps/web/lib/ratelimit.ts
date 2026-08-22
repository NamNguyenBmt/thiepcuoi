/**
 * Giới hạn tần suất.
 *
 * Hai hiện thực, cùng một thuật toán (sliding window log):
 *   - có REDIS_URL → Redis, dùng chung được giữa nhiều instance/tiến trình
 *   - không có     → bộ nhớ tiến trình, đủ cho một instance (mặc định, không
 *                     cần cài/chạy gì thêm — dev và một instance production
 *                     vẫn đúng như cấu hình)
 *
 * "Chưa hoàn hảo" (một instance không Redis) vẫn hơn hẳn "không có gì": không
 * có nó thì form đăng nhập cho phép thử mật khẩu vô hạn với tốc độ mạng.
 */

import { once } from './once';

export interface RateLimitResult {
  ok: boolean;
  /** Còn bao nhiêu lượt trong cửa sổ hiện tại */
  remaining: number;
  /** Giây phải chờ, chỉ có nghĩa khi ok = false */
  retryAfter: number;
}

interface Limiter {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  /** Chạm nhẹ để chứng minh nối được, không ghi gì — health check dùng */
  ping(): Promise<void>;
  /** Mô tả ngắn để in ra log lúc khởi động — biết mình đang đếm ở đâu */
  describe(): string;
}

// ─────────────────────────── Bộ nhớ tiến trình ───────────────────────────

interface Bucket {
  hits: number[];
}

function memoryLimiter(): Limiter {
  const buckets = new Map<string, Bucket>();

  return {
    describe: () => 'bộ nhớ tiến trình (một instance)',
    // Bộ nhớ thì luôn "nối được": có chính nó là đủ
    ping: async () => {},
    hit: async (key, limit, windowMs) => {
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
    },
  };
}

// ─────────────────────────── Redis ───────────────────────────

/**
 * Bộ lệnh tối thiểu cần từ client Redis, tách khỏi kiểu của `ioredis` — dùng để
 * test thuật toán bằng client giả trong bộ nhớ, không cần dựng Redis thật.
 */
export interface RedisLike {
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown>;
  zcard(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<unknown>;
  pexpire(key: string, ms: number): Promise<unknown>;
  /** Điểm (timestamp) của phần tử cũ nhất còn lại trong set, null nếu set rỗng */
  oldestScore(key: string): Promise<number | null>;
}

/**
 * Cùng thuật toán sliding-window-log với bản bộ nhớ: sorted set ghi
 * `score = timestamp`, mỗi lần hit thì xoá phần tử ngoài cửa sổ rồi đếm.
 * `describe` truyền vào ngoài để không lộ connection string thật ra log.
 */
export function createRedisLimiter(client: RedisLike, describe: string): Limiter {
  return {
    describe: () => describe,
    // Đếm phần tử của một khoá không ai ghi: một lệnh đọc, không đụng dữ liệu
    // thật, và vẫn đủ để lộ ra nếu không nối được Redis.
    ping: async () => {
      await client.zcard('ratelimit:ping');
    },
    hit: async (key, limit, windowMs) => {
      const now = Date.now();
      const windowKey = `ratelimit:${key}`;

      await client.zremrangebyscore(windowKey, 0, now - windowMs);
      const count = await client.zcard(windowKey);

      if (count >= limit) {
        const oldest = await client.oldestScore(windowKey);
        const retryAfter = oldest == null ? Math.ceil(windowMs / 1000) : Math.ceil((windowMs - (now - oldest)) / 1000);
        return { ok: false, remaining: 0, retryAfter };
      }

      // Member ngẫu nhiên: hai hit cùng millisecond mới không đè điểm của nhau
      const member = `${now}-${Math.random().toString(36).slice(2)}`;
      await client.zadd(windowKey, now, member);
      await client.pexpire(windowKey, windowMs);

      return { ok: true, remaining: limit - count - 1, retryAfter: 0 };
    },
  };
}

async function connectRedis(url: string): Promise<Limiter> {
  const { default: IORedis } = await import('ioredis');
  const client = new IORedis(url);

  const wrapped: RedisLike = {
    zremrangebyscore: (key, min, max) => client.zremrangebyscore(key, min, max),
    zcard: (key) => client.zcard(key),
    zadd: (key, score, member) => client.zadd(key, score, member),
    pexpire: (key, ms) => client.pexpire(key, ms),
    oldestScore: async (key) => {
      // `stop` của ioredis chỉ nhận string/Buffer, không nhận number như `start`
      const res = await client.zrange(key, 0, '0', 'WITHSCORES');
      return res[1] ? Number(res[1]) : null;
    },
  };

  // Không lộ mật khẩu/user trong connection string ra log
  const safeUrl = url.replace(/\/\/[^@]*@/, '//***@');
  return createRedisLimiter(wrapped, `Redis (${safeUrl})`);
}

// ─────────────────────────── Chọn một lần ───────────────────────────

export function selectLimiterKind(env: NodeJS.ProcessEnv = process.env): 'memory' | 'redis' {
  return env.REDIS_URL ? 'redis' : 'memory';
}

const limiter = once(async () => {
  const url = process.env.REDIS_URL;
  const chosen = url ? await connectRedis(url) : memoryLimiter();
  console.log(`[ratelimit] đang dùng ${chosen.describe()}`);
  return chosen;
});

function getLimiter(): Promise<Limiter> {
  return limiter.get();
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return (await getLimiter()).hit(key, limit, windowMs);
}

/**
 * Chạm thật vào bộ đếm rồi cho biết đang đếm ở đâu — để health check nói ra được.
 *
 * Nhìn từ ngoài, hạn mức đúng, hạn mức bị nhân lên theo số instance, và Redis
 * chết hẳn trông y hệt nhau cho tới lúc bị lạm dụng thật; còn dòng log lúc khởi
 * động thì trôi mất ngay. Chuỗi trả về không kèm mật khẩu (xem `connectRedis`).
 */
export async function rateLimitBackend(): Promise<string> {
  const backend = await getLimiter();
  await backend.ping();
  return backend.describe();
}

/** Khoá theo IP. Sau proxy thì tin x-forwarded-for; tự host thẳng thì không có header này. */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${prefix}:${forwarded || 'local'}`;
}

/** Chỉ dùng trong test: quên lựa chọn/trạng thái cũ để lần sau đọc lại biến môi trường */
export function resetRateLimits(): void {
  limiter.reset();
}
