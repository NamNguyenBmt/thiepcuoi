'use client';

/**
 * Vỏ client của trang thiệp.
 *
 * Đây là chỗ duy nhất nối renderer với thế giới bên ngoài: gọi API, phát nhạc,
 * đo devicePixelRatio. Bản thân `CanvasRenderer` không biết gì về fetch hay
 * router, nên editor tái sử dụng được nguyên vẹn.
 *
 * Ngoài canvas còn một lớp "vỏ trang": khung thiệp, tim bay, thanh công cụ,
 * bảng QR. Chúng cố ý nằm ngoài `TemplateDoc` — người thiết kế mẫu không phải
 * chừa chỗ cho chúng, và đổi vỏ không đụng tới mẫu nào.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasRenderer, RuntimeProvider } from '@thiepcuoi/runtime';
import type { RsvpPayload, Wish } from '@thiepcuoi/runtime';
import { unpackDoc } from '@thiepcuoi/schema';
import type { InviteData } from '@thiepcuoi/schema';
import { AudioToggle } from './AudioToggle';
import { HeartRain } from './HeartRain';
import { InviteToolbar } from './InviteToolbar';
import { QrPanel } from './QrPanel';

export interface InviteViewProps {
  docPacked: string;
  data: InviteData | null;
  inviteId: string | null;
  initialWishes: Wish[];
  initialHearts?: number;
  assetBase: string;
  /** URL công khai của thiệp — dùng cho bảng QR */
  shareUrl?: string;
  qrDataUrl?: string;
}

/** Gộp các lần bấm tim trong khoảng này thành một request */
const HEART_FLUSH_MS = 900;

export function InviteView({
  docPacked,
  data,
  inviteId,
  initialWishes,
  initialHearts = 0,
  assetBase,
  shareUrl = '',
  qrDataUrl = '',
}: InviteViewProps) {
  // Giải nén một lần: doc 120 KB, parse lại mỗi lần render là phí
  const doc = useMemo(() => unpackDoc(docPacked), [docPacked]);
  const [wishes, setWishes] = useState<Wish[]>(initialWishes);
  const [dpr, setDpr] = useState(2);
  const [hearts, setHearts] = useState(initialHearts);
  const [burst, setBurst] = useState(0);

  // Số lượt bấm chưa gửi đi. Giữ trong ref chứ không phải state: nó đổi liên
  // tục khi người ta bấm nhanh, và không có gì cần vẽ lại theo nó.
  const pending = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, 3));
  }, []);

  const post = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  async function submitRsvp(payload: RsvpPayload) {
    if (!inviteId) return; // xem thử mẫu thì không ghi gì
    await post(`/api/invites/${inviteId}/rsvp`, payload);
    if (payload.message.trim()) {
      setWishes((prev) => [
        { id: `tmp-${Date.now()}`, name: payload.name, message: payload.message, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    }
  }

  async function submitWish(wish: { name: string; message: string }) {
    if (!inviteId) return;
    const saved = (await post(`/api/invites/${inviteId}/wishes`, wish)) as Wish;
    setWishes((prev) => [saved, ...prev]);
  }

  /**
   * Bắn tim: hiệu ứng và bộ đếm chạy ngay tại chỗ, còn việc ghi lên server thì
   * gộp lại rồi gửi sau. Bấm tim là hành vi bấm dồn dập — mỗi lần một request
   * thì vừa tốn vừa chạm trần rate limit ngay lập tức.
   */
  function fireHeart() {
    if (!inviteId) return;
    setHearts((n) => n + 1);
    setBurst((n) => n + 1);
    pending.current += 1;

    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(async () => {
      const amount = pending.current;
      pending.current = 0;
      if (amount <= 0) return;
      try {
        const res = (await post(`/api/invites/${inviteId}/hearts`, { amount })) as { hearts: number };
        // Lấy tổng thật từ server: trong lúc mình bấm có thể có người khác cũng bấm
        setHearts(res.hearts);
      } catch {
        /* Mạng chập chờn thì thôi, con số tại chỗ vẫn đúng với những gì khách vừa bấm */
      }
    }, HEART_FLUSH_MS);
  }

  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
  }, []);

  return (
    <div className="tc-stage">
      <style>{`
        .tc-stage {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 0%, #fdf6f4 0%, #f4f1f2 55%, #efeaec 100%);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 0;
          position: relative;
        }
        .tc-frame {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 500px;
          background: var(--tc-card-bg, #fff);
        }
        .tc-scroll { overflow: visible; }

        /* Màn hình rộng: dựng khung như đang cầm điện thoại, thiệp cuộn bên trong */
        @media (min-width: 900px) {
          .tc-stage { padding: 24px 0 96px; align-items: center; }
          .tc-frame {
            border-radius: 6px;
            box-shadow: 0 18px 60px rgba(80, 40, 40, 0.18);
            overflow: hidden;
          }
          .tc-scroll {
            overflow-y: auto;
            height: min(calc(100vh - 120px), 900px);
            scrollbar-width: thin;
          }
        }
      `}</style>

      <HeartRain burstSignal={burst} />

      <div className="tc-frame" style={{ ['--tc-card-bg' as string]: doc.canvas.background }}>
        <div className="tc-scroll">
          <RuntimeProvider
            value={{ assetBase, mode: 'render', data, dpr, wishes, submitRsvp, submitWish }}
          >
            <CanvasRenderer doc={doc} />
          </RuntimeProvider>
        </div>
      </div>

      {doc.audio?.key && <AudioToggle audio={doc.audio} assetBase={assetBase} />}

      <InviteToolbar
        hearts={hearts}
        onHeart={fireHeart}
        onSendWish={submitWish}
        readOnly={!inviteId}
      />

      {shareUrl && qrDataUrl && <QrPanel qrDataUrl={qrDataUrl} url={shareUrl} />}
    </div>
  );
}
