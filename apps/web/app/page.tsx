import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { listTemplates } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Trang chủ cho người dùng thật, không phải bảng liệt kê cho dev.
 *
 * Cố ý **không** liệt kê thiệp đã phát hành: link thiệp vốn công khai để khách
 * mời không cần tài khoản, nhưng "ai có link thì xem được" khác hẳn "cả nước
 * lướt trang chủ là thấy đám cưới nhà người ta". Muốn xem thử thì đã có
 * `/mau/[slug]` — đúng mẫu đó với dữ liệu minh hoạ, không đụng thiệp của ai.
 */
export default async function HomePage() {
  const [templates, user] = await Promise.all([listTemplates(), currentUser()]);
  const demo = templates[0];

  return (
    <>
      <header style={header}>
        <Link href="/" style={brand}>
          ThiepCuoiOnline
        </Link>
        <div style={{ flex: 1 }} />
        {user ? (
          <>
            <span style={hello}>{user.name}</span>
            <Link href="/quan-ly" style={btnPrimary}>
              Thiệp của tôi
            </Link>
          </>
        ) : (
          <>
            <Link href="/dang-nhap" style={btnGhost}>
              Đăng nhập
            </Link>
            <Link href="/dang-ky" style={btnPrimary}>
              Đăng ký
            </Link>
          </>
        )}
      </header>

      <section style={hero}>
        <p style={kicker}>Save the date</p>
        <h1 style={heroTitle}>
          Thiệp cưới online
          <br />
          cho ngày trọng đại
        </h1>
        <p style={heroSub}>
          Chọn mẫu có sẵn, điền tên hai bạn, rồi gửi một đường link. Khách mở trên điện thoại là xem
          được ngay — xác nhận tham dự, gửi lời chúc, xem chỉ đường tới nơi tổ chức.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={user ? '/quan-ly' : '/dang-ky'} style={ctaPrimary}>
            {user ? 'Tới thiệp của tôi' : 'Tạo thiệp miễn phí'}
          </Link>
          {demo && (
            <Link href={`/mau/${demo.slug}`} style={ctaGhost}>
              Xem thử một tấm thiệp
            </Link>
          )}
        </div>
      </section>

      <main style={main}>
        <div style={featureRow}>
          <Feature title="Kéo thả tự do" text="Sửa mẫu bằng editor trực quan, thấy sao thì khách thấy vậy." />
          <Feature title="Khách phản hồi ngay" text="Xác nhận tham dự, số người đi, lời chúc — thống kê gọn một chỗ." />
          <Feature title="Gửi bằng link & QR" text="Không cần in, không cần khách cài gì. Mở là xem." />
        </div>

        <h2 style={h2}>Mẫu thiệp</h2>
        <div style={grid}>
          {templates.map((t) => (
            <Link key={t.id} href={`/mau/${t.slug}`} style={cardLink}>
              <div style={thumb}>
                <span style={thumbName}>{t.name}</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <strong style={{ display: 'block' }}>{t.name}</strong>
                <span style={{ color: '#8a7f7c', fontSize: 12 }}>
                  {t.usageCount > 0 ? `${t.usageCount} cặp đôi đã dùng` : 'Mẫu mới'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer style={footer}>
        ThiepCuoiOnline · {new Date().getFullYear()}
        {!user && (
          <>
            {' · '}
            <Link href="/dang-ky" style={{ color: '#7a2c2c' }}>
              Tạo thiệp của bạn
            </Link>
          </>
        )}
      </footer>
    </>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ flex: '1 1 220px' }}>
      <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>
      <span style={{ color: '#6b6360', fontSize: 13, lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

// ─────────────────────────── Style ───────────────────────────

const header = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px clamp(14px, 4vw, 24px)',
  background: '#fff',
  borderBottom: '1px solid #ece5e3',
  position: 'sticky',
  top: 0,
  zIndex: 10,
} as const;

const brand = {
  fontSize: 'clamp(14px, 4vw, 16px)',
  fontWeight: 700,
  color: '#7a2c2c',
  textDecoration: 'none',
  letterSpacing: '0.01em',
} as const;

const hello = { color: '#6b6360', fontSize: 13, marginRight: 4 } as const;

const btnBase = {
  padding: '8px clamp(10px, 3vw, 14px)',
  whiteSpace: 'nowrap',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
} as const;

const btnGhost = { ...btnBase, color: '#7a2c2c', border: '1px solid #e3d3d0' } as const;
const btnPrimary = { ...btnBase, color: '#fff', background: '#7a2c2c' } as const;

/**
 * `clamp()` thay cho media query: style nội tuyến không viết được `@media`, mà
 * khách mời phần lớn mở bằng điện thoại — để cỡ chữ cố định thì tiêu đề tràn.
 */
const hero = {
  background: 'linear-gradient(180deg, #fdf6f4 0%, #f7edea 100%)',
  padding: 'clamp(44px, 9vw, 72px) 20px clamp(52px, 10vw, 80px)',
  textAlign: 'center',
} as const;

const kicker = {
  margin: 0,
  fontSize: 12,
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: '#a08b86',
} as const;

const heroTitle = {
  margin: '12px 0 0',
  fontSize: 'clamp(27px, 7vw, 40px)',
  lineHeight: 1.2,
  color: '#7a2c2c',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontWeight: 400,
} as const;

const heroSub = {
  maxWidth: 520,
  margin: '16px auto 28px',
  color: '#6b6360',
  fontSize: 15,
  lineHeight: 1.7,
} as const;

const ctaPrimary = {
  padding: '12px 24px',
  borderRadius: 999,
  background: '#7a2c2c',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
} as const;

const ctaGhost = {
  padding: '12px 24px',
  borderRadius: 999,
  background: '#fff',
  color: '#7a2c2c',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  border: '1px solid #e3d3d0',
} as const;

const main = { maxWidth: 880, margin: '0 auto', padding: '0 24px 56px' } as const;

const featureRow = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 28,
  padding: '32px 0',
  borderBottom: '1px solid #ece5e3',
} as const;

const h2 = { fontSize: 18, margin: '32px 0 14px', color: '#1f2328' } as const;

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 16,
} as const;

const cardLink = {
  display: 'block',
  background: '#fff',
  borderRadius: 12,
  overflow: 'hidden',
  textDecoration: 'none',
  color: 'inherit',
  border: '1px solid #ece5e3',
} as const;

const thumb = {
  height: 132,
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(135deg, #fdf6f4 0%, #efdedb 100%)',
} as const;

const thumbName = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 22,
  color: '#7a2c2c',
} as const;

const footer = {
  padding: '20px 24px 32px',
  textAlign: 'center',
  color: '#8a7f7c',
  fontSize: 13,
} as const;
