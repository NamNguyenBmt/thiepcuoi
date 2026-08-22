/**
 * Renderer dùng chung cho editor và trang thiệp công khai.
 *
 * Quy tắc quan trọng nhất của package này: KHÔNG viết bản render thứ hai cho
 * editor. Editor bọc thêm lớp chọn/kéo lên trên cây này, còn cây này thì chỉ
 * đọc `mode` từ context để tắt animation và tắt tương tác.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TemplateDoc, Section, FontDef, EffectsConfig } from '@thiepcuoi/schema';
import { assetUrl } from '@thiepcuoi/schema';
import { KEYFRAMES_CSS } from './animation';
import { componentFor } from './registry';
import { RuntimeProvider, useRuntime } from './context';
import type { RuntimeValue } from './context';
import { imageUrl } from './image';

export interface CanvasRendererProps {
  doc: TemplateDoc;
  className?: string;
  style?: CSSProperties;
  /** Bỏ lazy-mount: editor cần mọi node có mặt để chọn được từ panel layer */
  eager?: boolean;
  /**
   * Section có `top` nhỏ hơn ngưỡng này (px canvas) luôn được mount ngay từ lần
   * vẽ đầu, kể cả trên server. Không có nó thì trang SSR trả về HTML rỗng —
   * mọi section đều chờ IntersectionObserver, mà server không chạy effect.
   *
   * Ngưỡng phải là hằng số, KHÔNG được phụ thuộc viewport: server và client
   * cần tính ra cùng một kết quả, nếu không sẽ hydration mismatch.
   */
  eagerUntil?: number;
}

export function CanvasRenderer({ doc, className, style, eager, eagerUntil = 2000 }: CanvasRendererProps) {
  const runtime = useRuntime();
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(runtime.containerWidth);

  // Bề rộng thật quyết định scale. ResizeObserver thay vì window.resize để
  // khung nhúng trong panel editor cũng co giãn đúng.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? el.clientWidth;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / doc.canvas.baseWidth;

  const nodesBySection = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of doc.order) {
      const node = doc.nodes[id];
      if (!node) continue;
      const list = map.get(node.sectionId);
      if (list) list.push(id);
      else map.set(node.sectionId, [id]);
    }
    return map;
  }, [doc.order, doc.nodes]);

  const css = useMemo(() => fontCss(doc.fonts, runtime.assetBase) + KEYFRAMES_CSS, [doc.fonts, runtime.assetBase]);

  const childRuntime: Partial<RuntimeValue> = { ...runtime, containerWidth: width, scale };

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        // transform: scale() không đổi chiều cao bố cục, phải tự đặt lại
        height: doc.canvas.height * scale,
        overflow: 'hidden',
        background: doc.canvas.background,
        ...style,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="tc-canvas"
        style={{
          position: 'relative',
          width: doc.canvas.baseWidth,
          height: doc.canvas.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <RuntimeProvider value={childRuntime}>
          {doc.sections.map((section) => (
            <SectionView
              key={section.id}
              section={section}
              doc={doc}
              nodeIds={nodesBySection.get(section.id) ?? []}
              eager={eager || runtime.mode === 'editor' || section.top < eagerUntil}
            />
          ))}
          <FallingEffect effects={doc.effects} />
        </RuntimeProvider>
      </div>
    </div>
  );
}

/**
 * Một section chỉ mount khi sắp vào tầm nhìn, và mount rồi thì ở lại.
 * rootMargin 60% để nội dung kịp tải trước khi người dùng cuộn tới.
 */
function SectionView({
  section,
  doc,
  nodeIds,
  eager,
}: {
  section: Section;
  doc: TemplateDoc;
  nodeIds: string[];
  eager: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(eager);
  const { assetBase, dpr, scale } = useRuntime();

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '60% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  const bg = section.background;
  const bgImage = bg?.imgKey ? imageUrl(assetBase, bg.imgKey, doc.canvas.baseWidth * scale, dpr) : null;

  return (
    <div
      ref={ref}
      data-section-id={section.id}
      style={{
        position: 'absolute',
        top: section.top,
        left: 0,
        width: doc.canvas.baseWidth,
        height: section.height,
        backgroundColor: bg?.color,
        backgroundImage: bgImage ? `url("${bgImage}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {mounted &&
        nodeIds.map((id) => {
          const node = doc.nodes[id]!;
          const Component = componentFor(node);
          if (!Component) return null;
          // Toạ độ node là tuyệt đối trên canvas, phải quy về gốc của section
          return (
            <div key={id} style={{ position: 'absolute', top: -section.top, left: 0, width: doc.canvas.baseWidth }}>
              <Component node={node} />
            </div>
          );
        })}
    </div>
  );
}

interface FallingItem {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

/** Tim / cánh hoa / tuyết rơi. Phủ toàn canvas, không bắt sự kiện chuột. */
function FallingEffect({ effects }: { effects: EffectsConfig }) {
  const { assetBase, dpr, mode } = useRuntime();
  const f = effects.falling;

  // Vị trí ngẫu nhiên nên chỉ sinh ở client, nếu không server và client ra hai
  // kết quả khác nhau và React báo hydration mismatch.
  const [items, setItems] = useState<FallingItem[]>([]);
  useEffect(() => {
    if (!f.enabled || mode === 'editor') {
      setItems([]);
      return;
    }
    setItems(
      Array.from({ length: f.density }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: (6 + Math.random() * 6) / Math.max(f.speed, 0.1),
        size: 10 + Math.random() * 14,
      })),
    );
  }, [f.enabled, f.density, f.speed, mode]);

  if (!f.enabled || mode === 'editor' || items.length === 0) return null;

  const icon = f.imgKey ? imageUrl(assetBase, f.imgKey, 48, dpr, { format: 'png' }) : null;
  const fallback = { heart: '❤', petal: '🌸', snow: '❄', custom: '❤' }[f.kind];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 9998 }} aria-hidden>
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${it.left}%`,
            width: it.size,
            height: it.size,
            fontSize: it.size,
            lineHeight: 1,
            animationName: 'tc-fall',
            animationDuration: `${it.duration}s`,
            animationDelay: `${it.delay}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
          }}
        >
          {icon ? <img src={icon} alt="" style={{ width: '100%', height: '100%' }} /> : fallback}
        </div>
      ))}
    </div>
  );
}

/**
 * Font tự host thành @font-face, Google Font thành @import.
 * @import bắt buộc đứng đầu stylesheet nên nối chuỗi theo đúng thứ tự đó.
 */
export function fontCss(fonts: FontDef[], assetBase: string): string {
  const imports: string[] = [];
  const faces: string[] = [];

  for (const f of fonts) {
    if (f.source.kind === 'google') {
      const family = f.source.name.replace(/ /g, '+');
      const weights = f.weights.length ? `:wght@${[...f.weights].sort((a, b) => a - b).join(';')}` : '';
      imports.push(`@import url('https://fonts.googleapis.com/css2?family=${family}${weights}&display=swap');`);
    } else {
      faces.push(
        `@font-face{font-family:'${f.family}';src:url('${assetUrl(assetBase, f.source.key)}') format('woff2');font-display:swap;}`,
      );
    }
  }
  return imports.join('\n') + '\n' + faces.join('\n') + '\n';
}
