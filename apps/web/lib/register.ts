/**
 * Kiểm dữ liệu đăng ký tài khoản.
 *
 * Tách khỏi route để test được trực tiếp, không phải dựng request Next.js thật
 * — giống cách `invite.ts`/`slug.ts` tách việc kiểm dữ liệu ra khỏi handler.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;
const MAX_NAME = 100;

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface RegisterError {
  error: string;
  status: 400;
}

export function parseRegisterInput(body: unknown): RegisterInput | RegisterError {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, MAX_NAME) : '';

  if (!EMAIL_RE.test(email)) return { error: 'Email không hợp lệ', status: 400 };
  if (password.length < MIN_PASSWORD) {
    return { error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự`, status: 400 };
  }
  if (!name) return { error: 'Thiếu tên', status: 400 };

  return { email, password, name };
}

export function isRegisterError(v: RegisterInput | RegisterError): v is RegisterError {
  return 'error' in v;
}
