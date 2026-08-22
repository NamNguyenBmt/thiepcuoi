import { NextResponse } from 'next/server';
import { createAsset, listAssets } from '@/lib/db';
import { MAX_UPLOAD_BYTES, storeUpload } from '@/lib/storage';
import { isFailure, requireUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });
  // Admin thấy toàn bộ kho, người dùng thường chỉ thấy ảnh mình tải lên
  return NextResponse.json(await listAssets(user.role === 'admin' ? undefined : user.id));
}

/**
 * Upload ảnh. `multipart/form-data`, trường `file`, cho phép nhiều file một lần
 * vì người dùng thường kéo cả album vào.
 *
 * Trả về `key` chứ không trả URL: `TemplateDoc` lưu key, còn URL do renderer
 * ghép lúc vẽ (kèm resize/format theo màn hình thật). Lưu URL vào doc là tự
 * khoá mình vào một domain CDN.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (isFailure(user)) return NextResponse.json({ error: user.error }, { status: user.status });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Body phải là multipart/form-data' }, { status: 400 });
  }

  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'Không có file nào' }, { status: 400 });

  const saved = [];
  const failed = [];

  for (const file of files) {
    const result = await storeUpload(file);
    if ('error' in result) {
      failed.push({ name: file.name, error: result.error, status: result.status });
      continue;
    }
    saved.push(
      await createAsset({
        id: result.id,
        key: result.key,
        ownerId: user.id,
        mime: result.mime,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        originalName: file.name.slice(0, 200),
      }),
    );
  }

  // Một file hỏng trong mười file không nên làm hỏng cả mẻ: trả về cả hai danh sách
  const status = saved.length > 0 ? 201 : (failed[0]?.status ?? 400);
  return NextResponse.json({ saved, failed, maxBytes: MAX_UPLOAD_BYTES }, { status });
}
