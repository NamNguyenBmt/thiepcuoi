/**
 * Góc đăng nhập trên thanh công cụ.
 *
 * Không chặn cả editor khi chưa đăng nhập: xem mẫu và thử kéo thả vẫn được,
 * chỉ Lưu và Thư viện ảnh là cần tài khoản. Chặn hết ngay từ đầu chỉ làm người
 * dùng khó chịu mà không bảo vệ thêm được gì — server mới là chỗ chặn thật.
 */

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSession } from '../session';

export function SessionBar() {
  const { user, loading, error, refresh, login, logout } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <span style={{ fontSize: 12, color: '#6b7280' }}>…</span>;

  if (user) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ color: '#6b7280' }} title={`${user.name} · ${user.role}`}>
          {user.email}
        </span>
        <button onClick={() => void logout()} style={btn}>
          Đăng xuất
        </button>
      </span>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) setPassword('');
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="email"
        placeholder="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ ...input, width: 150 }}
      />
      <input
        type="password"
        placeholder="mật khẩu"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ ...input, width: 100 }}
      />
      <button type="submit" disabled={busy} style={btn}>
        {busy ? '…' : 'Đăng nhập'}
      </button>
      {error && <span style={{ color: '#b42318', fontSize: 11 }}>{error}</span>}
    </form>
  );
}

const btn = {
  padding: '3px 8px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
} as const;

const input = {
  padding: '3px 6px',
  border: '1px solid #d8dbe0',
  borderRadius: 4,
  fontSize: 12,
} as const;
