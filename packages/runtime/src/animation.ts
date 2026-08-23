/**
 * Hai loại chuyển động:
 *   - entrance  : chạy một lần khi node lọt vào viewport (props.transition)
 *   - continuous: lặp vô hạn (props.continuousAnimation)
 *
 * Cả hai đều tắt trong editor: người dùng đang kéo một node mà nó cứ lắc lư
 * hoặc mờ đi thì không chỉnh được. `useReveal` trả về revealed = true ngay.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Transition, ContinuousAnimation, EntranceEffect } from '@thiepcuoi/schema';
import { useRuntime } from './context';

const HIDDEN_TRANSFORM: Record<EntranceEffect, string> = {
  none: 'none',
  fade: 'none',
  'slide-up': 'translateY(40px)',
  'slide-down': 'translateY(-40px)',
  'slide-left': 'translateX(40px)',
  'slide-right': 'translateX(-40px)',
  'zoom-in': 'scale(0.85)',
  'zoom-out': 'scale(1.15)',
  flip: 'perspective(600px) rotateX(60deg)',
  'blur-in': 'none',
};

export interface Reveal {
  ref: (el: HTMLElement | null) => void;
  style: CSSProperties;
}

/**
 * IntersectionObserver một-lần-rồi-thôi. Ngưỡng âm 10% để node bắt đầu hiện
 * khi đã vào hẳn trong khung, không phải lúc mới ló ra 1px.
 */
export function useReveal(transition: Transition, baseTransform?: string): Reveal {
  const { mode } = useRuntime();
  const enabled = mode === 'render' && transition.effectEnabled && transition.effectType !== 'none';
  const [revealed, setRevealed] = useState(!enabled);
  const observed = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || revealed) return;
    const el = observed.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, revealed]);

  const ref = (el: HTMLElement | null) => {
    observed.current = el;
  };

  if (!enabled) return { ref, style: {} };

  return { ref, style: entranceStyle(transition, revealed, baseTransform) };
}

/**
 * Style của hiệu ứng vào, tách khỏi hook để test được.
 *
 * Lúc đã hiện thì **không được nhắc tới** `opacity`, `filter`, `willChange`.
 * `NodeShell` ghép `{...baseStyle(p), ...reveal.style}`; trong JS, một khoá mang
 * giá trị `undefined` vẫn là khoá và vẫn đè lên giá trị phía trước. Viết
 * `opacity: revealed ? undefined : 0` là xoá sạch `opacity` riêng của node ngay
 * khi nó hiện ra — tấm nền kính mờ khai báo `opacity: 0.55` hoá trắng đặc, che
 * mất ảnh phía sau. Nên chỉ gán khi thật sự cần.
 */
export function entranceStyle(
  transition: Transition,
  revealed: boolean,
  baseTransform?: string,
): CSSProperties {
  const hidden = HIDDEN_TRANSFORM[transition.effectType];
  const enter = [hidden !== 'none' ? hidden : '', baseTransform ?? ''].filter(Boolean).join(' ');

  const style: CSSProperties = {
    transform: revealed ? baseTransform : enter || undefined,
    transitionProperty: 'opacity, transform, filter',
    transitionDuration: `${transition.effectDuration}s`,
    transitionDelay: `${transition.effectDelay}s`,
    transitionTimingFunction: transition.effectEasing,
  };

  if (!revealed) {
    style.opacity = 0;
    style.willChange = 'opacity, transform';
    if (transition.effectType === 'blur-in') style.filter = 'blur(12px)';
  }

  return style;
}

export function continuousStyle(anim: ContinuousAnimation, mode: 'render' | 'editor'): CSSProperties {
  if (mode === 'editor' || anim.type === 'none') return {};
  return {
    animationName: `tc-${anim.type}`,
    animationDuration: `${anim.duration}s`,
    animationDelay: `${anim.delay}s`,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  };
}

/**
 * Keyframes chèn một lần ở gốc cây render. Không dùng CSS-in-JS runtime để
 * trang public không phải tải thêm thư viện chỉ vì 6 bộ keyframes.
 *
 * `prefers-reduced-motion` tắt hết animation lặp — thiệp cưới hay bị mở trên
 * điện thoại và chuyển động vô hạn là thứ đầu tiên gây khó chịu.
 */
export const KEYFRAMES_CSS = `
@keyframes tc-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-6deg); }
  75% { transform: rotate(6deg); }
}
@keyframes tc-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes tc-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes tc-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
@keyframes tc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes tc-heartbeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.15); }
  30% { transform: scale(1); }
  45% { transform: scale(1.12); }
  60% { transform: scale(1); }
}
@keyframes tc-fall {
  from { transform: translateY(-10%) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  to { transform: translateY(110vh) rotate(360deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .tc-canvas *, .tc-canvas *::before, .tc-canvas *::after {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
`;
