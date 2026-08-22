import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { unpackDoc } from '@thiepcuoi/schema';
import { canEdit, currentUser } from '@/lib/auth';
import { getInviteById, getTemplateById } from '@/lib/db';
import { InviteForm } from '@/components/InviteForm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function EditInvitePage({ params }: Params) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) redirect(`/dang-nhap?next=/quan-ly/thiep/${id}`);

  const invite = await getInviteById(id);
  if (!invite || !canEdit(user, invite.ownerId)) notFound();

  const template = await getTemplateById(invite.templateId);
  if (!template) notFound();

  // Slot ảnh lấy từ chính mẫu: người điền thiệp chỉ thấy đúng những khung ảnh
  // mà người thiết kế đã chừa ra, không phải đoán tên slot.
  const doc = unpackDoc(template.docPacked);
  const photoSlots = [
    ...new Set(
      Object.values(doc.nodes)
        .filter((n) => n.type === 'Photo' && n.props.slot)
        .map((n) => (n.type === 'Photo' ? n.props.slot! : '')),
    ),
  ];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <Link href="/quan-ly" style={{ fontSize: 13, color: '#7a2c2c' }}>
          ← Quản lý
        </Link>
        <h1 style={{ fontSize: 20, margin: '6px 0 2px' }}>Nội dung thiệp</h1>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          Mẫu: {template.name} · {invite.publishedAt ? 'đã phát hành' : 'nháp'}
        </div>
      </header>

      <InviteForm
        inviteId={invite.id}
        initialSlug={invite.slug}
        initialPublished={Boolean(invite.publishedAt)}
        initialData={invite.data}
        photoSlots={photoSlots}
      />
    </main>
  );
}
