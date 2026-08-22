/**
 * Xác thực: mật khẩu băm bằng scrypt, phiên đăng nhập giữ trong cookie.
 *
 * Dùng `node:crypto` thay vì bcrypt/argon2: không phụ thuộc native, mà scrypt
 * vốn được thiết kế đúng cho việc băm mật khẩu (tốn bộ nhớ nên GPU khó bẻ).
 */

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { createSession, deleteSession, getSessionByTokenHash, getUserById } from './db';
import type { UserRow } from './db';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;
export const SESSION_COOKIE = 'tc_session';
const SESSION_DAYS = 7;

// ─────────────────────────── Mật khẩu ───────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);

  // So sánh theo thời gian hằng số: `===` để lộ độ dài tiền tố khớp qua thời gian chạy
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ─────────────────────────── Phiên ───────────────────────────

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Tạo phiên và đặt cookie. Trả về token để test dùng, code thường không cần. */
export async function startSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();

  await createSession({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // JS trong trang không đọc được → XSS không lấy được phiên
    sameSite: 'lax', // đủ chặn CSRF cho các request POST từ site khác
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });

  return token;
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashToken(token));
  store.delete(SESSION_COOKIE);
}

/** Người dùng của request hiện tại, hoặc null nếu chưa đăng nhập / phiên hết hạn */
export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getSessionByTokenHash(hashToken(token));
  if (!session || session.expiresAt <= new Date().toISOString()) return null;

  return getUserById(session.userId);
}

// ─────────────────────────── Phân quyền ───────────────────────────

export interface AuthFailure {
  error: string;
  status: 401 | 403;
}

/**
 * Trả về user, hoặc mô tả lỗi để route chuyển thành response.
 *
 * 401 và 403 khác nhau và cả hai đều cần: 401 = chưa đăng nhập (client nên hiện
 * form đăng nhập), 403 = đã đăng nhập nhưng không phải của mình (hiện form là vô nghĩa).
 */
export async function requireUser(): Promise<UserRow | AuthFailure> {
  const user = await currentUser();
  return user ?? { error: 'Cần đăng nhập', status: 401 };
}

export function canEdit(user: UserRow, ownerId: string): boolean {
  return user.role === 'admin' || user.id === ownerId;
}

export function isFailure(value: UserRow | AuthFailure): value is AuthFailure {
  return 'error' in value;
}

/** Thông tin an toàn để trả về client — không bao giờ kèm passwordHash */
export function publicUser(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
