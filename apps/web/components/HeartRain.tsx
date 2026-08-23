'use client';

/**
 * Tim bay quanh tấm thiệp.
 *
 * Hai lớp khác nhau, cố ý — và nằm ở hai độ cao khác nhau:
 *
 *   - **nền**: vài chục quả trôi chậm, có sẵn từ lúc mở trang. Trên màn hình
 *     rộng nó nằm *dưới* khung thiệp, chỉ để hai bên trang khỏi trống trải.
 *     Nhưng dưới 900px thì khung thiệp phủ kín bề ngang và nền của nó đục, nên
 *     ở đó lớp này phải vượt lên trên — không thì cả hiệu ứng biến mất đúng
 *     trên thiết bị mà hầu hết khách mời dùng để mở thiệp.
 *   - **bắn**: loạt tim bay vọt lên khi khách bấm nút. Luôn nằm trên khung
 *     thiệp ở mọi bề ngang: đây là phản hồi cho một cú chạm, mà phản hồi bị
 *     che thì người ta tưởng nút hỏng và bấm tiếp.
 *
 * Nằm ngoài canvas nên không liên quan tới `effects.falling` của template —
 * cái đó là hiệu ứng bên trong tấm thiệp và người thiết kế bật/tắt được.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const GLYPHS = ['❤', '💕', '💖', '🤍'];

interface Drift {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  glyph: string;
  opacity: number;
}

interface Burst {
  id: number;
  left: number;
  drift: number;
  duration: number;
  size: number;
  glyph: string;
}

export interface HeartRainProps {
  /** Tăng giá trị này để bắn một loạt tim */
  burstSignal: number;
  /** Số tim mỗi loạt */
  burstSize?: number;
}

export function HeartRain({ burstSignal, burstSize = 12 }: HeartRainProps) {
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  // Sinh ở client: `Math.random()` chạy trên server ra kết quả khác, React sẽ
  // báo hydration mismatch.
  useEffect(() => {
    setDrifts(
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 12,
        duration: 14 + Math.random() * 12,
        size: 10 + Math.random() * 16,
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!,
        opacity: 0.25 + Math.random() * 0.4,
      })),
    );
  }, []);

  useEffect(() => {
    if (burstSignal === 0) return;

    const batch: Burst[] = Array.from({ length: burstSize }, () => ({
      id: nextId.current++,
      left: 8 + Math.random() * 84,
      drift: -60 + Math.random() * 120,
      duration: 2.4 + Math.random() * 1.6,
      size: 16 + Math.random() * 20,
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!,
    }));
    setBursts((prev) => [...prev, ...batch]);

    // Dọn sau khi animation xong, nếu không thì bấm nhiều lần là DOM phình mãi
    const ids = new Set(batch.map((b) => b.id));
    const timer = setTimeout(() => {
      setBursts((prev) => prev.filter((b) => !ids.has(b.id)));
    }, 4200);
    return () => clearTimeout(timer);
  }, [burstSignal, burstSize]);

  const layer: CSSProperties = {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  return (
    <>
      <style>{`
        /* Dưới khung thiệp trên màn rộng, trên khung thiệp khi khung phủ kín */
        .tc-heart-drift { z-index: 1; }
        @media (max-width: 899px) { .tc-heart-drift { z-index: 3; } }
        .tc-heart-burst { z-index: 3; }

        @keyframes tc-drift {
          0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); }
          100% { transform: translate3d(0, 112vh, 0) rotate(28deg); }
        }
        @keyframes tc-burst {
          0%   { transform: translate3d(0, 0, 0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translate3d(var(--tc-drift), -78vh, 0) scale(1.15); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-heart { animation: none !important; opacity: 0.25 !important; }
        }
      `}</style>

      <div aria-hidden className="tc-heart-drift" style={layer}>
      {drifts.map((d) => (
        <span
          key={`d-${d.id}`}
          className="tc-heart"
          style={{
            position: 'absolute',
            top: 0,
            left: `${d.left}%`,
            fontSize: d.size,
            lineHeight: 1,
            opacity: d.opacity,
            animation: `tc-drift ${d.duration}s linear ${d.delay}s infinite`,
          }}
        >
          {d.glyph}
        </span>
      ))}
      </div>

      <div aria-hidden className="tc-heart-burst" style={layer}>
      {bursts.map((b) => (
        <span
          key={`b-${b.id}`}
          className="tc-heart"
          style={{
            position: 'absolute',
            bottom: '9vh',
            left: `${b.left}%`,
            fontSize: b.size,
            lineHeight: 1,
            ['--tc-drift' as string]: `${b.drift}px`,
            animation: `tc-burst ${b.duration}s ease-out forwards`,
          }}
        >
          {b.glyph}
        </span>
      ))}
      </div>
    </>
  );
}
