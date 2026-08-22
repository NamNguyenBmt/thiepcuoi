/**
 * "Tôi không phải robot" tự host — không gọi dịch vụ ngoài, không cần API key.
 *
 * Yếu hơn hCaptcha/Turnstile trước bot có script cố tình nhắm vào form này,
 * nhưng chặn được spam tự động phổ thông mà vẫn chạy offline được — đúng
 * triết lý PGlite/scrypt của repo: không phụ thuộc gì để dev/test chạy được.
 *
 * Thử thách là một phép cộng, ký bằng HMAC kèm hạn dùng — không cần lưu vào
 * DB hay bộ nhớ dùng chung, vì toàn bộ trạng thái nằm trong chính token trả
 * về cho client.
 */

import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const TTL_MS = 5 * 60_000;

/**
 * Secret và sổ token đã dùng, treo trên `globalThis` để cả tiến trình xài chung.
 *
 * Không để làm biến module được: Next đóng gói mỗi route thành một bundle riêng,
 * nên cùng file này bị nạp thành **nhiều bản** trong một tiến trình (dev còn
 * nạp lại sau mỗi lần hot-reload). Mỗi bản tự sinh secret riêng thì token ký ở
 * `/api/captcha` không đời nào verify nổi ở `/api/auth/register` — người dùng
 * giải đúng vẫn bị báo sai, tức là **không đăng ký được**. Đã dính thật ở bản
 * chạy local, nơi CAPTCHA_SECRET không được đặt.
 *
 * Đặt CAPTCHA_SECRET thì mọi bản nạp — và mọi instance — dùng chung một secret;
 * đó cũng là điều bắt buộc khi chạy nhiều instance (xem README).
 */
const kho = globalThis as typeof globalThis & {
  __tcCaptcha?: { secret: string; used: Map<string, number> };
};
kho.__tcCaptcha ??= { secret: randomBytes(32).toString('hex'), used: new Map() };

const SECRET = process.env.CAPTCHA_SECRET ?? kho.__tcCaptcha.secret;

const sign = (payload: string): string => createHmac('sha256', SECRET).update(payload).digest('hex');

export interface Captcha {
  question: string;
  token: string;
}

/** `ttlMs` chỉnh được để test hạn dùng mà không phải chờ thật 5 phút */
export function createCaptcha(ttlMs: number = TTL_MS): Captcha {
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
  const answer = a + b;
  const expires = Date.now() + ttlMs;
  const payload = `${answer}.${expires}`;
  const token = Buffer.from(`${payload}.${sign(payload)}`).toString('base64url');
  return { question: `${a} + ${b}`, token };
}

interface Decoded {
  answer: number;
  expires: number;
}

function decode(token: string): Decoded | null {
  let raw: string;
  try {
    raw = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [answerStr, expiresStr, sig] = parts as [string, string, string];

  const expectedSig = sign(`${answerStr}.${expiresStr}`);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  // Độ dài khác nhau thì chắc chắn sai — timingSafeEqual đòi hai buffer cùng
  // độ dài, nên phải tự chặn trước khi gọi, không thì nó ném lỗi thay vì false.
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  const answer = Number(answerStr);
  const expires = Number(expiresStr);
  if (!Number.isFinite(answer) || !Number.isFinite(expires)) return null;
  return { answer, expires };
}

/**
 * Token đã dùng đúng một lần thì không cho dùng lại — giải được một thử thách
 * rồi gửi lại token đó nhiều lần sẽ né được cả rate limit lẫn việc phải giải
 * lại. Dọn định kỳ như `buckets` của ratelimit.ts để Map không phình vô hạn.
 *
 * Cũng nằm trên `globalThis` vì lý do như secret: mỗi bản nạp một sổ riêng thì
 * token dùng rồi vẫn qua được ở bản khác, tức là chặn dùng lại chỉ có tiếng.
 * Nhiều instance thì vẫn mỗi instance một sổ — đó là giới hạn cố hữu, và cũng
 * chỉ là lớp phòng thủ phụ bên cạnh rate limit.
 */
const used = kho.__tcCaptcha.used;

function cleanupUsed(now: number): void {
  if (used.size <= 5000) return;
  for (const [token, expires] of used) {
    if (expires <= now) used.delete(token);
  }
}

export function verifyCaptcha(token: unknown, answer: unknown): boolean {
  if (typeof token !== 'string' || typeof answer !== 'string' || !answer.trim()) return false;
  if (used.has(token)) return false;

  const decoded = decode(token);
  if (!decoded) return false;

  const now = Date.now();
  if (now > decoded.expires) return false;
  if (Number(answer) !== decoded.answer) return false;

  used.set(token, decoded.expires);
  cleanupUsed(now);
  return true;
}

/** Chỉ dùng trong test: quên token đã dùng để test sau không bị vướng test trước */
export function resetCaptchaState(): void {
  used.clear();
}
