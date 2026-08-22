import Link from 'next/link';
import { listInvites, listTemplates } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [templates, invites] = await Promise.all([listTemplates(), listInvites()]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>ThiepCuoiOnline</h1>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Trang thiệp công khai. Cùng renderer với editor, chỉ khác dữ liệu truyền vào.
      </p>

      <Section title="Thiệp đã phát hành">
        {invites.map((invite) => (
          <Card
            key={invite.id}
            href={`/thiep/${invite.slug}`}
            title={`${invite.data.groom.shortName} & ${invite.data.bride.shortName}`}
            sub={`/thiep/${invite.slug}`}
          />
        ))}
      </Section>

      <Section title="Mẫu thiệp">
        {templates.map((t) => (
          <Card key={t.id} href={`/mau/${t.slug}`} title={t.name} sub={`/mau/${t.slug} · dùng ${t.usageCount} lần`} />
        ))}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>{title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </section>
  );
}

function Card({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 14,
        background: '#fff',
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <strong>{title}</strong>
      <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{sub}</div>
    </Link>
  );
}
