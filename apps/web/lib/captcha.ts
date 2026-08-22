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
 * Không đặt CAPTCHA_SECRET thì mỗi tiến trình tự sinh secret riêng — đủ dùng vì
 * thử thách chỉ sống vài phút trong một phiên làm form. Production nhiều
 * instance mà instance sinh thử thách khác instance verify thì cần đặt secret
 * dùng chung, nếu không một phần yêu cầu sẽ bị từ chối oan (không phải lỗ hổng,
 * chỉ là trải nghiệm xấu — xem README).
 */
const SECRET = process.env.CAPTCHA_SECRET ?? randomBytes(32).toString('hex');

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
 */
const used = new Map<string, number>();

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
