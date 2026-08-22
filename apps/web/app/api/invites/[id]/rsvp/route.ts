import { NextResponse } from 'next/server';
import { createRsvp, getInviteById, listRsvps } from '@/lib/db';
import { canEdit, isFailure, requireUser } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/ratelimit';
import type { RsvpRow } from '@/lib/db';

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

type RsvpInput = Omit<RsvpRow, 'id' | 'createdAt' | 'inviteId'>;

/**
 * Body đến từ trình duyệt nên phải tự kiểm, không tin kiểu TypeScript.
 * Kiểm tay thay vì kéo thêm zod: form RSVP chỉ có 7 trường và hình dạng của nó
 * do RsvpPayload quy định, không phải schema do người dùng cấu hình.
 *
 * Kiểu trả về khai báo tường minh — để suy luận thì ternary làm `guestSide` nới
 * thành string và lỗi chỉ lộ ra ở chỗ gọi.
 */
function parseRsvp(body: unknown): RsvpInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length === 0 || name.length > 120) return null;
  if (typeof b.attending !== 'boolean') return null;

  const count = Number(b.attendeeCount);
  const guestSide = b.guestSide === 'groom' || b.guestSide === 'bride' ? b.guestSide : null;
  const transportation = b.transportation === 'self' || b.transportation === 'pickup' ? b.transportation : null;

  return {
    name,
    attending: b.attending,
    attendeeCount: Number.isFinite(count) ? Math.min(50, Math.max(0, Math.trunc(count))) : 0,
    guestSide,
    transportation,
    pickupSlotId: typeof b.pickupSlotId === 'string' ? b.pickupSlotId : null,
    message: typeof b.message === 'string' ? b.message.slice(0, 2000) : '',
  };
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const limited = await tooMany(request, 'rsvp');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const parsed = parseRsvp(body);
  if (!parsed) return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });

  const saved = await createRsvp({ inviteId: id, ...parsed });
  return NextResponse.json(saved, { status: 201 });
}

/**
 * Danh sách khách đã xác nhận — chỉ chủ thiệp (hoặc admin) đọc được.
 *
 * POST thì để mở: khách mời không có tài khoản, bắt đăng nhập mới xác nhận được
 * là chặn đúng người cần phục vụ.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  const invite = await getInviteById(id);
  if (!invite) return NextResponse.json({ error: 'Không tìm thấy thiệp' }, { status: 404 });
  if (!canEdit(user, invite.ownerId)) {
    return NextResponse.json({ error: 'Thiệp này không phải của bạn' }, { status: 403 });
  }

  const rows = await listRsvps(id);
  return NextResponse.json({
    total: rows.length,
    attending: rows.filter((r) => r.attending).length,
    guests: rows.reduce((sum, r) => sum + (r.attending ? r.attendeeCount : 0), 0),
    rows,
  });
}
