import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { getHearts, getInviteById, getInviteBySlug, getSlugRedirectTarget, getTemplateById, listWishes } from '@/lib/db';
import { pickShareKey, sharePath, SHARE_HEIGHT, SHARE_WIDTH } from '@/lib/share-image';
import { InviteView } from '@/components/InviteView';
import { ASSET_BASE } from '@/lib/config';
import { siteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const invite = await getInviteBySlug(slug);
  if (!invite) return { title: 'Không tìm thấy thiệp' };

  const { groom, bride } = invite.data;
  const title = `Thiệp cưới ${groom.shortName} & ${bride.shortName}`;

  const key = pickShareKey(invite.data.photos);
  const path = key ? sharePath(invite.slug, key) : null;
  const image = path
    ? {
        url: `${await siteOrigin()}${path}`,
        width: SHARE_WIDTH,
        height: SHARE_HEIGHT,
        alt: title,
      }
    : null;

  return {
    title,
    description: invite.data.message,
    openGraph: {
      title,
      description: invite.data.message,
      type: 'website',
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description: invite.data.message,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

export default async function InvitePage({ params }: Params) {
  const { slug } = await params;
  const invite = await getInviteBySlug(slug);

  if (!invite) {
    // Không có trực tiếp — có thể đây là slug cũ trước khi chủ thiệp đổi tên.
    // Slug đang sống trên `invites` luôn được tra ở trên trước, nên không có
    // chuyện một redirect che mất thiệp thật đang đứng đúng slug đó.
    const targetId = await getSlugRedirectTarget(slug);
    const target = targetId ? await getInviteById(targetId) : null;
    if (target?.publishedAt) permanentRedirect(`/thiep/${target.slug}`);
    notFound();
  }
  if (!invite.publishedAt) notFound();

  const template = await getTemplateById(invite.templateId);
  if (!template) notFound();

  // Lời chúc và số tim lấy sẵn ở server để lần vẽ đầu đã có nội dung, không nháy trống
  const [wishes, hearts, origin] = await Promise.all([
    listWishes(invite.id),
    getHearts(invite.id),
    siteOrigin(),
  ]);

  const shareUrl = `${origin}/thiep/${slug}`;
  // Sinh ở server: khách không phải tải thư viện QR về chỉ để nhìn một ô vuông
  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    margin: 1,
    width: 264,
    color: { dark: '#7a2c2c', light: '#ffffff' },
  });

  return (
    <InviteView
      docPacked={template.docPacked}
      data={invite.data}
      inviteId={invite.id}
      initialWishes={wishes.map((w) => ({ id: w.id, name: w.name, message: w.message, createdAt: w.createdAt }))}
      initialHearts={hearts}
      assetBase={ASSET_BASE}
      shareUrl={shareUrl}
      qrDataUrl={qrDataUrl}
    />
  );
}
