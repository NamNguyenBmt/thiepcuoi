import { NextResponse } from 'next/server';
import { allSlugs, getInviteById, updateInvite } from '@/lib/db';
import { canEdit, isFailure, requireUser } from '@/lib/auth';
import { parseInviteData } from '@/lib/invite';
import { validateSlug } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  const invite = await getInviteById(id);
  if (!invite) return NextResponse.json({ error: 'Không tìm thấy thiệp' }, { status: 404 });
  if (!canEdit(user, invite.ownerId)) {
    return NextResponse.json({ error: 'Thiệp này không phải của bạn' }, { status: 403 });
  }

  return NextResponse.json(invite);
}

/**
 * Sửa nội dung thiệp: dữ liệu cặp đôi, slug, và trạng thái phát hành.
 *
 * Đổi slug là đổi luôn đường link đã gửi cho khách, nên chỉ đổi khi client gửi
 * `slug` khác hẳn — slug cũ được giữ lại trong `invite_slug_redirects` để
 * `/thiep/[slug]` chuyển hướng thay vì trả 404 (xem lib/db.ts::updateInvite).
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;

  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  const invite = await getInviteById(id);
  if (!invite) return NextResponse.json({ error: 'Không tìm thấy thiệp' }, { status: 404 });
  if (!canEdit(user, invite.ownerId)) {
    return NextResponse.json({ error: 'Thiệp này không phải của bạn' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof updateInvite>[1] = {};

  if (b.data !== undefined) patch.data = parseInviteData(b.data);

  if (typeof b.slug === 'string' && b.slug !== invite.slug) {
    const slug = validateSlug(b.slug);
    if (!slug) return NextResponse.json({ error: 'Slug phải có ít nhất 3 ký tự chữ/số' }, { status: 400 });
    if ((await allSlugs('invites')).includes(slug)) {
      return NextResponse.json({ error: `Slug "${slug}" đã có người dùng` }, { status: 409 });
    }
    patch.slug = slug;
  }

  if (typeof b.published === 'boolean') {
    patch.publishedAt = b.published ? (invite.publishedAt ?? new Date().toISOString()) : null;
  }

  const saved = await updateInvite(id, patch, invite.slug);
  return NextResponse.json(saved);
}
