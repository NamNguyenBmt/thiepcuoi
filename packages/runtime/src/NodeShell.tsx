/**
 * Khung ngoài dùng chung cho mọi node.
 *
 * Có hai lớp div lồng nhau, không phải một, vì cả animation vào (transition
 * transform) lẫn animation lặp (keyframes transform) đều ghi vào `transform`.
 * Để chung một phần tử thì cái sau đè cái trước và node "nhảy" khi vừa hiện ra.
 *   - div ngoài: vị trí, khung, viền, bóng, animation vào
 *   - div trong: animation lặp, nội dung
 */

import type { CSSProperties, ReactNode } from 'react';
import type { BaseProps, NodeType, TemplateNode } from '@thiepcuoi/schema';
import { baseStyle, transformCss } from './style';
import { useReveal, continuousStyle } from './animation';
import { useRuntime } from './context';

export interface NodeProps<T extends NodeType> {
  node: Extract<TemplateNode, { type: T }>;
}

export interface NodeShellProps {
  id: string;
  p: BaseProps;
  flipX?: boolean;
  flipY?: boolean;
  innerStyle?: CSSProperties;
  ariaLabel?: string;
  children: ReactNode;
}

export function NodeShell({ id, p, flipX = false, flipY = false, innerStyle, ariaLabel, children }: NodeShellProps) {
  const { mode, openMap } = useRuntime();
  const reveal = useReveal(p.transition, transformCss(p, flipX, flipY));

  if (p.hidden) return null;

  const inner: CSSProperties = {
    width: '100%',
    height: '100%',
    ...continuousStyle(p.continuousAnimation, mode),
    ...innerStyle,
  };

  const body = <div style={inner}>{children}</div>;

  return (
    <div
      ref={reveal.ref}
      data-node-id={id}
      aria-label={ariaLabel}
      style={{ ...baseStyle(p, flipX, flipY), ...reveal.style }}
    >
      {p.hyperlink && mode === 'render' ? wrapLink(p.hyperlink, body, openMap) : body}
    </div>
  );
}

/**
 * hyperlink hỗ trợ 2 dạng:
 *   "https://..."            → mở tab mới
 *   "action:map:<query>"     → gọi openMap của app
 */
function wrapLink(href: string, body: ReactNode, openMap: ReturnType<typeof useRuntime>['openMap']): ReactNode {
  if (href.startsWith('action:map:')) {
    const query = href.slice('action:map:'.length);
    return (
      <button
        type="button"
        onClick={() => openMap({ lat: null, lng: null, query })}
        style={{ all: 'unset', display: 'block', width: '100%', height: '100%', cursor: 'pointer' }}
      >
        {body}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
      {body}
    </a>
  );
}
