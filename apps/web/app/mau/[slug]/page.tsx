import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTemplateBySlug } from '@/lib/db';
import { InviteView } from '@/components/InviteView';
import { ASSET_BASE, EDITOR_URL } from '@/lib/config';
import { placeholderFor } from '@/lib/placeholder';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  return template ? { title: `Mẫu ${template.name}` } : { title: 'Không tìm thấy mẫu' };
}

/**
 * Xem thử mẫu: cùng renderer, nhưng dữ liệu là bộ giả và `inviteId = null` nên
 * form không ghi gì xuống database.
 */
export default async function TemplatePage({ params }: Params) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) notFound();

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 10000,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'rgba(255,255,255,0.92)',
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
          fontSize: 12,
        }}
      >
        <Link href="/" style={{ color: '#7a2c2c' }}>
          ← Mẫu thiệp
        </Link>
        <span style={{ color: '#9ca3af' }}>xem thử · dữ liệu minh hoạ</span>
        <a
          href={`${EDITOR_URL}?template=${slug}`}
          style={{
            color: '#fff', background: '#7a2c2c', padding: '4px 10px',
            borderRadius: 6, textDecoration: 'none', fontWeight: 600,
          }}
        >
          Chỉnh sửa mẫu này
        </a>
      </div>

      <InviteView
        docPacked={template.docPacked}
        data={placeholderFor(slug)}
        inviteId={null}
        initialWishes={[]}
        assetBase={ASSET_BASE}
      />
    </>
  );
}
