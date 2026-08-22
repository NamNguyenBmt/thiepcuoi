import { NextResponse } from 'next/server';
import { getAssetByKey } from '@/lib/db';
import { isValidKey, parseTransform, renderAsset } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ key: string[] }> };

/**
 * Phục vụ ảnh kèm biến đổi: /api/assets/uploads/<id>.jpg?resize=800x&format=webp
 *
 * Đây là chỗ các tham số do `assetUrl` sinh ra thực sự có tác dụng. Vì key là
 * uuid nên nội dung không bao giờ đổi dưới cùng một URL → cache vĩnh viễn.
 */
export async function GET(request: Request, { params }: Params) {
  const { key: segments } = await params;
  const key = segments.join('/');

  // Kiểm hình dạng key TRƯỚC khi đụng tới hệ thống file: chặn ../ và mọi biến thể
  if (!isValidKey(key)) {
    return NextResponse.json({ error: 'Khoá không hợp lệ' }, { status: 400 });
  }

  const row = await getAssetByKey(key);
  if (!row) return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 404 });

  const transform = parseTransform(new URL(request.url).searchParams);

  try {
    const { body, mime } = await renderAsset(key, row.mime, transform);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'content-type': mime,
        'content-length': String(body.length),
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    // Crop vượt ra ngoài ảnh là lỗi của tham số, không phải lỗi server
    return NextResponse.json({ error: `Không xử lý được ảnh: ${String(err)}` }, { status: 400 });
  }
}
