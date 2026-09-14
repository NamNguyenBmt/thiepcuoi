import { NextResponse } from 'next/server';
import { getAssetByKey, getInviteBySlug } from '@/lib/db';
import { isValidKey, renderAsset } from '@/lib/storage';
import { SHARE_WIDTH, shareCrop, shareKeyForFile } from '@/lib/share-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string; file: string }> };

/**
 * Ảnh xem trước khi chia sẻ link thiệp: /thiep/<slug>/anh/<uuid>.jpg
 * Lý do có đường dẫn riêng thay vì dùng /api/assets: xem lib/share-image.ts.
 */
export async function GET(_request: Request, { params }: Params) {
  const { slug, file } = await params;

  const invite = await getInviteBySlug(slug);
  if (!invite?.publishedAt) return NextResponse.json({ error: 'Không tìm thấy thiệp' }, { status: 404 });

  const key = shareKeyForFile(invite.data.photos, file);
  if (!key || !isValidKey(key)) return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 404 });

  const row = await getAssetByKey(key);
  if (!row) return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 404 });

  try {
    const crop = row.width > 0 && row.height > 0 ? shareCrop(row.width, row.height) : undefined;
    const { body } = await renderAsset(key, row.mime, { crop, resize: SHARE_WIDTH, format: 'jpeg', quality: 85 });
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'content-type': 'image/jpeg',
        'content-length': String(body.length),
        // uuid trong đường dẫn đổi theo ảnh, nên giữ vĩnh viễn được — xem sharePath
        'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: `Không xử lý được ảnh: ${String(err)}` }, { status: 500 });
  }
}
