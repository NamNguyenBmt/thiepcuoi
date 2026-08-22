'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/dang-nhap');
    // refresh() để server component vẽ lại với cookie đã bị xoá
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      style={{
        padding: '5px 10px',
        border: '1px solid #d8dbe0',
        borderRadius: 6,
        background: '#fff',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      Đăng xuất
    </button>
  );
}
