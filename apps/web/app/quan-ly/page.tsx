import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { listInvitesByOwner, listRsvps, listTemplates, listWishes } from '@/lib/db';
import { LogoutButton } from '@/components/LogoutButton';
import { CreateInviteForm, CreateTemplateForm } from '@/components/CreateForms';
import { EDITOR_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Trang của chủ thiệp: danh sách khách đã xác nhận.
 *
 * Chặn ngay ở server bằng `currentUser()` — kiểm tra ở client thì dữ liệu đã
 * kịp gửi xuống trước khi giao diện kịp giấu nó đi.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/dang-nhap?next=/quan-ly');

  const invites = await listInvitesByOwner(user.id);
  const allTemplates = await listTemplates();
  const templates = allTemplates.filter((t) => user.role === 'admin' || t.ownerId === user.id);

  const rows = await Promise.all(
    invites.map(async (invite) => {
      const rsvps = await listRsvps(invite.id);
      return {
        invite,
        total: rsvps.length,
        attending: rsvps.filter((r) => r.attending).length,
        guests: rsvps.reduce((sum, r) => sum + (r.attending ? r.attendeeCount : 0), 0),
        wishes: (await listWishes(invite.id)).length,
        rsvps,
      };
    }),
  );

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>Quản lý</h1>
          <div style={{ color: '#6b7280', fontSize: 13 }}>
            {user.name} · {user.email} · {user.role}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/" style={{ fontSize: 13, color: '#7a2c2c' }}>
          Trang chủ
        </Link>
        <LogoutButton />
      </header>

      <h2 style={h2}>Mẫu của bạn ({templates.length})</h2>
      <div style={{ ...card, marginBottom: 10 }}>
        <CreateTemplateForm
          templates={allTemplates.map((t) => ({ id: t.id, name: t.name }))}
          editorUrl={EDITOR_URL}
        />
      </div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        {templates.map((t) => (
          <div key={t.id} style={card}>
            <strong>{t.name}</strong>
            <span style={{ color: '#6b7280', fontSize: 12 }}>
              {' '}
              · bản {t.revision} · dùng {t.usageCount} lần ·{' '}
              <Link href={`/mau/${t.slug}`}>xem thử</Link> ·{' '}
              <a href={`${EDITOR_URL}?template=${t.slug}`}>mở trong editor</a>
            </span>
          </div>
        ))}
      </div>

      <h2 style={h2}>Thiệp của bạn ({rows.length})</h2>
      <div style={{ ...card, marginBottom: 10 }}>
        <CreateInviteForm templates={allTemplates.map((t) => ({ id: t.id, name: t.name }))} />
      </div>
      {rows.map(({ invite, total, attending, guests, wishes, rsvps }) => (
        <section key={invite.id} style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong>
              {invite.data.groom.shortName} &amp; {invite.data.bride.shortName}
            </strong>
            <Link href={`/quan-ly/thiep/${invite.id}`} style={{ fontSize: 12 }}>
              sửa nội dung
            </Link>
            {invite.publishedAt ? (
              <Link href={`/thiep/${invite.slug}`} style={{ fontSize: 12 }}>
                /thiep/{invite.slug}
              </Link>
            ) : (
              <span style={{ fontSize: 12, color: '#b45309' }}>nháp · chưa phát hành</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, margin: '10px 0', fontSize: 13 }}>
            <Stat label="Phản hồi" value={total} />
            <Stat label="Sẽ dự" value={attending} />
            <Stat label="Tổng khách" value={guests} />
            <Stat label="Lời chúc" value={wishes} />
          </div>

          {rsvps.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={th}>Tên</th>
                  <th style={th}>Tham dự</th>
                  <th style={th}>Số người</th>
                  <th style={th}>Khách của</th>
                  <th style={th}>Lời chúc</th>
                </tr>
              </thead>
              <tbody>
                {rsvps.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>{r.name}</td>
                    <td style={td}>{r.attending ? 'Có' : 'Không'}</td>
                    <td style={td}>{r.attendeeCount}</td>
                    <td style={td}>
                      {r.guestSide === 'groom' ? 'Nhà trai' : r.guestSide === 'bride' ? 'Nhà gái' : '—'}
                    </td>
                    <td style={td}>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: 11 }}>{label}</div>
    </div>
  );
}

const h2 = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6b7280',
} as const;

const card = {
  padding: 14,
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
} as const;

const th = { padding: '4px 6px', borderBottom: '1px solid #e6e8eb', fontWeight: 600 } as const;
const td = { padding: '4px 6px', borderBottom: '1px solid #f1f3f5' } as const;
