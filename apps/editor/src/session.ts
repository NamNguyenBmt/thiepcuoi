/**
 * Phiên đăng nhập của editor.
 *
 * Cookie phiên do apps/web đặt. Editor chạy ở cổng khác nhưng cookie không phân
 * biệt cổng, cộng thêm proxy `/api` nên trình duyệt gửi cookie đi kèm bình
 * thường — không cần token riêng cho editor.
 */

import { create } from 'zustand';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  loading: true,
  error: '',

  refresh: async () => {
    set({ loading: true, error: '' });
    try {
      const res = await fetch('/api/auth/me');
      set({ user: res.ok ? (await res.json()).user : null, loading: false });
    } catch (err) {
      // Web chưa chạy: không phải lỗi đăng nhập, đừng doạ người dùng bằng chữ đỏ
      set({ user: null, loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  login: async (email, password) => {
    set({ error: '' });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        set({ error: body?.error ?? `Lỗi ${res.status}` });
        return false;
      }
      set({ user: body.user, error: '' });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    set({ user: null });
  },
}));
