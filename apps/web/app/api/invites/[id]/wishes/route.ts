import { NextResponse } from 'next/server';
import { createWish, listWishes } from '@/lib/db';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Giới hạn theo IP. Khách mời không đăng nhập nên đây là lớp chặn duy nhất:
 * mở link ra internet mà không có nó thì một script bơm được vô hạn phản hồi.
 *
 * 6 lần / 10 phút: đủ cho một nhà gửi vài phản hồi và sửa lại khi gõ nhầm, mà
 * vẫn chặn được bơm hàng loạt. Bộ đếm nằm trong bộ nhớ tiến trình — chạy nhiều
 * instance thì cần Redis.
 */
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 6;

async function tooMany(request: Request, prefix: string) {
  const limit = await rateLimit(clientKey(request, prefix), MAX_PER_WINDOW, WINDOW_MS);
  if (limit.ok) return null;
  return NextResponse.json(
    { error: `Bạn gửi hơi nhiều rồi, thử lại sau ${limit.retryAfter}s nhé` },
    { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
  );
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(await listWishes(id));
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const limited = await tooMany(request, 'wish');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';

  if (!name || !message) {
    return NextResponse.json({ error: 'Thiếu tên hoặc lời chúc' }, { status: 400 });
  }

  const saved = await createWish({
    inviteId: id,
    name: name.slice(0, 120),
    message: message.slice(0, 2000),
  });
  return NextResponse.json(saved, { status: 201 });
}
