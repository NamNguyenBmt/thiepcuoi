'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RegisterPage() {
  // useSearchParams cần Suspense bao ngoài, nếu không Next bắt lỗi lúc build
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/quan-ly';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? `Lỗi ${res.status}`);
        return;
      }
      router.replace(next);
      // refresh() để server component đọc lại cookie phiên vừa được đặt
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 'min(360px, 100%)',
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Tạo tài khoản</h1>

        <label style={label} htmlFor="name">
          Tên
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={field}
        />

        <label style={label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={field}
        />

        <label style={label} htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={field}
        />

        {error && <div style={{ color: '#b42318', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button type="submit" disabled={busy} style={submit}>
          {busy ? 'Đang tạo…' : 'Đăng ký'}
        </button>

        <div style={{ marginTop: 14, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
          Đã có tài khoản?{' '}
          <Link href={`/dang-nhap?next=${encodeURIComponent(next)}`} style={{ color: '#7a2c2c' }}>
            Đăng nhập
          </Link>
        </div>
      </form>
    </main>
  );
}

const label = { display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 } as const;

const field = {
  width: '100%',
  padding: '8px 10px',
  marginBottom: 14,
  border: '1px solid #d8dbe0',
  borderRadius: 6,
  fontSize: 14,
} as const;

const submit = {
  width: '100%',
  padding: '10px 12px',
  border: 'none',
  borderRadius: 6,
  background: '#7a2c2c',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;
