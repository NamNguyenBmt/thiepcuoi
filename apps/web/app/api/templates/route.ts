import { NextResponse } from 'next/server';
import { createEmptyDoc, packDoc, unpackDoc } from '@thiepcuoi/schema';
import { allSlugs, createTemplate, getTemplateById, listTemplates } from '@/lib/db';
import { isFailure, requireUser } from '@/lib/auth';
import { uniqueSlug } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Danh sách mẫu cho editor chọn mở. Không trả `docPacked` — nặng và chưa cần. */
export async function GET() {
  const rows = await listTemplates();
  return NextResponse.json(
    rows.map(({ id, slug, name, thumbnail, usageCount, ownerId }) => ({
      id,
      slug,
      name,
      thumbnail,
      usageCount,
      ownerId,
    })),
  );
}

/**
 * Tạo mẫu mới: hoặc canvas trống, hoặc nhân bản một mẫu có sẵn
 * (`fromTemplateId`) — nhân bản là cách người ta thực sự làm mẫu mới.
 *
 * Mẫu là thư viện công khai nên ai cũng nhân bản được; bản sao thuộc về người
 * bấm nút, mẫu gốc không đổi.
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
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Thiếu tên mẫu' }, { status: 400 });

  const id = `tpl-${crypto.randomUUID()}`;
  const slug = uniqueSlug(name, await allSlugs('templates'));

  let docPacked: string;
  if (typeof b.fromTemplateId === 'string') {
    const source = await getTemplateById(b.fromTemplateId);
    if (!source) return NextResponse.json({ error: 'Không tìm thấy mẫu nguồn' }, { status: 404 });

    // Đổi danh tính trong chính doc, nếu không bản sao vẫn mang id/slug của bản gốc
    const doc = unpackDoc(source.docPacked);
    doc.id = id;
    doc.slug = slug;
    doc.name = name;
    docPacked = packDoc(doc);
  } else {
    docPacked = packDoc(createEmptyDoc(id, name, slug));
  }

  const saved = await createTemplate({
    id,
    slug,
    name,
    ownerId: user.id,
    docPacked,
    thumbnail: null,
    usageCount: 0,
  });

  return NextResponse.json(saved, { status: 201 });
}
