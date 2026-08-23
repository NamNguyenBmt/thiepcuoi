/**
 * BaseProps → CSSProperties.
 *
 * Mọi node đi qua đúng một hàm này, nên editor và trang public không thể lệch
 * nhau về khung/viền/bóng/xoay. Node cụ thể chỉ thêm style riêng của nó.
 */

import type { CSSProperties } from 'react';
import type { BaseProps, Quad, BoxShadow } from '@thiepcuoi/schema';

const quad = (q: Quad) => `${q[0]}px ${q[1]}px ${q[2]}px ${q[3]}px`;

const radius = (q: Quad) => `${q[0]}px ${q[1]}px ${q[2]}px ${q[3]}px`;

function shadowCss(s: BoxShadow): string {
  return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${s.color}`;
}

function borderCss(p: BaseProps): CSSProperties {
  if (!p.borderSize || !p.borderColor) return {};
  const value = `${p.borderSize}px ${p.borderStyle} ${p.borderColor}`;
  if (p.borderPosition === 'all') return { border: value };
  const key = ({ top: 'borderTop', right: 'borderRight', bottom: 'borderBottom', left: 'borderLeft' } as const)[
    p.borderPosition
  ];
  return { [key]: value };
}

/** Xoay và lật gộp chung một transform để không đè lên nhau */
export function transformCss(p: BaseProps, flipX = false, flipY = false): string | undefined {
  const parts: string[] = [];
  if (p.rotation) parts.push(`rotate(${p.rotation}deg)`);
  if (flipX || flipY) parts.push(`scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`);
  return parts.length ? parts.join(' ') : undefined;
}

export function baseStyle(p: BaseProps, flipX = false, flipY = false): CSSProperties {
  return {
    position: 'absolute',
    top: p.top,
    left: p.left,
    width: p.width,
    height: p.height,
    backgroundColor: p.backgroundColor,
    padding: quad(p.padding),
    opacity: p.opacity,
    borderRadius: radius(p.borderRadius),
    boxShadow: p.hasShadow ? shadowCss(p.boxShadow) : undefined,
    // Safari vẫn cần tiền tố, mà kính mờ hỏng trên iPhone thì hỏng đúng chỗ
    // đông người xem thiệp nhất
    backdropFilter: p.backdropBlur ? `blur(${p.backdropBlur}px)` : undefined,
    WebkitBackdropFilter: p.backdropBlur ? `blur(${p.backdropBlur}px)` : undefined,
    zIndex: p.zIndex,
    transform: transformCss(p, flipX, flipY),
    boxSizing: 'border-box',
    // Node không có hyperlink thì không chặn cử chỉ cuộn của khung thiệp
    pointerEvents: p.hyperlink ? 'auto' : undefined,
    ...borderCss(p),
  };
}
