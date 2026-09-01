/**
 * Context dùng chung cho renderer.
 *
 * Renderer KHÔNG tự gọi API. Mọi thứ có tác dụng phụ (gửi RSVP, gửi lời chúc,
 * đọc danh sách lưu bút) đều đi qua context — nhờ vậy editor cắm bản giả lập,
 * trang public cắm bản thật, mà chỉ tồn tại một cây render duy nhất.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { deriveInviteData } from '@thiepcuoi/schema';
import type { InviteData } from '@thiepcuoi/schema';

export interface RsvpPayload {
  name: string;
  attending: boolean;
  attendeeCount: number;
  guestSide: 'groom' | 'bride' | null;
  transportation: 'self' | 'pickup' | null;
  pickupSlotId: string | null;
  message: string;
}

export interface Wish {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

export type RuntimeMode = 'render' | 'editor';

export interface RuntimeValue {
  /** Base URL của CDN ảnh, không có dấu / cuối */
  assetBase: string;
  mode: RuntimeMode;
  /** null khi xem mẫu trống — token sẽ hiển thị theo `mode` */
  data: InviteData | null;
  /** devicePixelRatio đã kẹp, dùng để chọn bề rộng ảnh yêu cầu */
  dpr: number;
  /** Bề rộng thật của khung chứa, px CSS */
  containerWidth: number;
  /** containerWidth / canvas.baseWidth — CanvasRenderer tự tính và cấp xuống.
   *  Node nhân với nó để xin CDN ảnh đúng bằng px thật đang hiển thị. */
  scale: number;
  submitRsvp: (payload: RsvpPayload) => Promise<void>;
  submitWish: (wish: { name: string; message: string }) => Promise<void>;
  wishes: Wish[];
  /** Mở bản đồ — tách ra để app quyết định mở tab mới hay modal */
  openMap: (target: { lat: number | null; lng: number | null; query: string }) => void;
  /**
   * Khách vừa chạm mở bì thư.
   *
   * Có riêng một hook cho việc này vì đó là **cú chạm đầu tiên** của khách vào
   * trang — điện thoại chỉ cho phát nhạc có tiếng từ trong một thao tác của
   * người dùng, nên đây là chỗ duy nhất bật nhạc mà không bị chặn. Renderer
   * không tự phát: app quyết định làm gì.
   */
  onEnvelopeOpen: () => void;
}

const noop = async () => {};

export const DEFAULT_RUNTIME: RuntimeValue = {
  assetBase: '',
  mode: 'render',
  data: null,
  dpr: 2,
  containerWidth: 500,
  scale: 1,
  submitRsvp: noop,
  submitWish: noop,
  wishes: [],
  openMap: ({ lat, lng, query }) => {
    const q = lat != null && lng != null ? `${lat},${lng}` : query;
    if (!q) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank', 'noopener');
  },
  onEnvelopeOpen: () => {},
};

const RuntimeContext = createContext<RuntimeValue>(DEFAULT_RUNTIME);

/**
 * Gắn trường chữ dẫn xuất (dateText, weekdayTime…) ngay tại đây, chứ không bắt
 * mỗi chỗ gọi tự nhớ: trang thiệp, trang xem thử mẫu và editor đều đi qua
 * provider này, nên token định dạng ngày chạy giống nhau ở cả ba.
 */
export function RuntimeProvider({ value, children }: { value: Partial<RuntimeValue>; children: ReactNode }) {
  const data = useMemo(() => deriveInviteData(value.data ?? null), [value.data]);
  return (
    <RuntimeContext.Provider value={{ ...DEFAULT_RUNTIME, ...value, data }}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntime(): RuntimeValue {
  return useContext(RuntimeContext);
}
