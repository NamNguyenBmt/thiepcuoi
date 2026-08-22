'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  // useSearchParams cần Suspense bao ngoài, nếu không Next bắt lỗi lúc build
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/quan-ly';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Đăng nhập</h1>

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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={field}
        />

        {error && <div style={{ color: '#b42318', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button type="submit" disabled={busy} style={submit}>
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
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
