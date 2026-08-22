import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { publicUser, startSession, verifyPassword } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limit = await rateLimit(clientKey(request, 'login'), 8, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Thử quá nhiều lần, đợi ${limit.retryAfter}s` },
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
  const email = typeof b.email === 'string' ? b.email : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
  }

  const user = await getUserByEmail(email);

  // Cùng một thông báo cho "email không tồn tại" và "sai mật khẩu": phân biệt hai
  // trường hợp là tặng kẻ tấn công danh sách email có thật.
  const invalid = NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
  if (!user) return invalid;
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;

  await startSession(user.id);
  return NextResponse.json({ user: publicUser(user) });
}
