import { NextResponse } from 'next/server';
import { unpackDoc, validateDoc } from '@thiepcuoi/schema';
import { deleteTemplate, getTemplateById, updateTemplate } from '@/lib/db';
import { canEdit, isFailure, requireUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const row = await getTemplateById(id);
  if (!row) return NextResponse.json({ error: 'Không tìm thấy mẫu' }, { status: 404 });
  return NextResponse.json(row);
}

/**
 * Lưu mẫu từ editor.
 *
 * Server tự giải nén và validate lại: client đã validate không có nghĩa là body
 * đến đây hợp lệ. Một doc hỏng lưu được vào DB sẽ làm chết trang thiệp của mọi
 * cặp đôi đang dùng mẫu đó, nên thà trả 422 còn hơn nhận bừa.
 *
 * `revision` là khoá chống ghi đè: editor gửi lại số nó đọc được lúc mở; nếu
 * trong lúc đó có tab khác đã lưu thì số không khớp và request bị từ chối.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;

  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  const existing = await getTemplateById(id);
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy mẫu' }, { status: 404 });

  if (!canEdit(user, existing.ownerId)) {
    return NextResponse.json({ error: 'Mẫu này không phải của bạn' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const docPacked = typeof b.docPacked === 'string' ? b.docPacked : null;
  if (!docPacked) return NextResponse.json({ error: 'Thiếu docPacked' }, { status: 400 });

  if (typeof b.revision === 'number' && b.revision !== existing.revision) {
    return NextResponse.json(
      {
        error: 'Mẫu đã được lưu ở nơi khác',
        yours: b.revision,
        current: existing.revision,
      },
      { status: 409 },
    );
  }

  let issues;
  try {
    const doc = unpackDoc(docPacked);
    issues = validateDoc(doc).filter((i) => i.level === 'error');
  } catch (err) {
    return NextResponse.json({ error: `Không giải nén được doc: ${String(err)}` }, { status: 400 });
  }

  if (issues.length > 0) {
    return NextResponse.json({ error: 'Doc không hợp lệ', issues }, { status: 422 });
  }

  const saved = await updateTemplate(id, {
    docPacked,
    ...(typeof b.name === 'string' && b.name.trim() ? { name: b.name.trim() } : {}),
  });

  return NextResponse.json(saved);
}

/**
 * Xoá mẫu. Từ chối nếu còn thiệp đang dùng: xoá được thì trang thiệp của họ
 * chết ngay, mà chủ mẫu không hề biết mình vừa làm gì.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  const existing = await getTemplateById(id);
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy mẫu' }, { status: 404 });
  if (!canEdit(user, existing.ownerId)) {
    return NextResponse.json({ error: 'Mẫu này không phải của bạn' }, { status: 403 });
  }

  const removed = await deleteTemplate(id);
  if (!removed) {
    return NextResponse.json({ error: 'Còn thiệp đang dùng mẫu này' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
