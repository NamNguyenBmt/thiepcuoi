import { NextResponse } from 'next/server';
import { allSlugs, createInvite, getTemplateById, listInvitesByOwner } from '@/lib/db';
import { isFailure, requireUser } from '@/lib/auth';
import { emptyInviteData, parseInviteData } from '@/lib/invite';
import { uniqueSlug } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });
  return NextResponse.json(await listInvitesByOwner(user.id));
}

/**
 * Tạo thiệp từ một mẫu. Thiệp mới luôn ở trạng thái nháp (`publishedAt: null`)
 * — không ai muốn link thiệp lộ ra ngoài khi tên còn chưa điền xong.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const templateId = typeof b.templateId === 'string' ? b.templateId : '';
  if (!templateId) return NextResponse.json({ error: 'Thiếu templateId' }, { status: 400 });

  const template = await getTemplateById(templateId);
  if (!template) return NextResponse.json({ error: 'Không tìm thấy mẫu' }, { status: 404 });

  const data = b.data ? parseInviteData(b.data) : emptyInviteData();

  // Slug lấy từ tên cặp đôi nếu đã có, không thì đặt tạm — đổi được sau
  const base = [data.groom.shortName, data.bride.shortName].filter(Boolean).join('-') || 'thiep-cuoi';
  const slug = uniqueSlug(base, await allSlugs('invites'));

  const saved = await createInvite({
    id: `inv-${crypto.randomUUID()}`,
    slug,
    ownerId: user.id,
    templateId,
    data,
    publishedAt: null,
  });

  return NextResponse.json(saved, { status: 201 });
}
