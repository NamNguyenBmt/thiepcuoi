import { NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db';
import { hashPassword, publicUser, startSession } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/ratelimit';
import { isRegisterError, parseRegisterInput } from '@/lib/register';
import { verifyCaptcha } from '@/lib/captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Lỏng hơn đăng nhập (8/phút): đăng ký là hành động một lần, cửa sổ dài hơn
  // vẫn chặn được tạo tài khoản hàng loạt mà không phiền người dùng thật.
  const limit = rateLimit(clientKey(request, 'register'), 5, 3600_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Đăng ký quá nhiều lần, đợi ${limit.retryAfter}s` },
      { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  // Kiểm captcha trước khi đụng tới DB: giải sai/hết hạn thì khỏi tốn một
  // lượt tra email trùng cho mỗi bot thử.
  if (!verifyCaptcha(b.captchaToken, b.captchaAnswer)) {
    return NextResponse.json({ error: 'Xác nhận chống spam sai hoặc đã hết hạn, thử lại' }, { status: 400 });
  }

  const parsed = parseRegisterInput(body);
  if (isRegisterError(parsed)) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { email, password, name } = parsed;

  // Không dùng thông báo "chung chung" như đăng nhập: ở đây phân biệt là cần
  // thiết, người dùng phải biết để chuyển sang đăng nhập thay vì thử lại.
  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: 'Email đã được dùng' }, { status: 409 });
  }

  const user = await createUser({
    id: `usr-${crypto.randomUUID()}`,
    email,
    name,
    passwordHash: await hashPassword(password),
    role: 'user',
  });

  await startSession(user.id);
  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
