import { NextResponse } from 'next/server';
import { addHearts, getHearts } from '@/lib/db';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Bắn tim.
 *
 * Khoáng đạt hơn lời chúc rất nhiều — bấm tim là hành vi bấm liên tục, chặn ở
 * mức 6 lần/10 phút như `wishes` thì hỏng tính năng. Client gộp các lần bấm
 * trong vài giây thành một request kèm `amount`, nên 40 request/phút là thoải
 * mái cho người dùng thật mà vẫn có trần.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

/** Trần mỗi lần gửi: chặn một request khai 10 triệu tim */
const MAX_AMOUNT = 50;

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json({ hearts: await getHearts(id) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const limit = rateLimit(clientKey(request, 'heart'), MAX_PER_WINDOW, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Bạn bấm nhanh quá, thử lại sau ${limit.retryAfter}s nhé` },
      { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const amount = Math.min(MAX_AMOUNT, Math.max(1, Math.trunc(Number(raw.amount) || 1)));

  return NextResponse.json({ hearts: await addHearts(id, amount) });
}
