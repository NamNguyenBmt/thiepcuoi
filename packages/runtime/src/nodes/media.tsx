import { useEffect, useRef, useState } from 'react';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl, imageSrcSet } from '../image';
import { EmptySlot } from './basic';

export function GalleryNode({ node }: NodeProps<'Gallery'>) {
  const { assetBase, dpr, mode, scale } = useRuntime();
  const p = node.props;

  if (p.photos.length === 0) {
    return (
      <NodeShell id={node.id} p={p}>
        {mode === 'editor' ? <EmptySlot label="Album trống" /> : null}
      </NodeShell>
    );
  }

  if (p.layout !== 'carousel') {
    const columns = p.layout === 'grid' ? 3 : 2;
    return (
      <NodeShell
        id={node.id}
        p={p}
        innerStyle={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 6,
          alignContent: 'start',
          overflowY: 'auto',
        }}
      >
        {p.photos.map((photo) => (
          <img
            key={photo.id}
            src={imageUrl(assetBase, photo.imageKey, (p.width * scale) / columns, dpr)}
            alt={photo.alt}
            loading={mode === 'editor' ? 'eager' : 'lazy'}
            style={{
              width: '100%',
              aspectRatio: p.layout === 'grid' ? '1 / 1' : undefined,
              objectFit: 'cover',
              borderRadius: 6,
              display: 'block',
            }}
          />
        ))}
      </NodeShell>
    );
  }

  return <Carousel node={node} />;
}

/** Kéo quá chừng này bề rộng khung thì tính là vuốt sang ảnh khác */
const SWIPE_THRESHOLD = 0.15;
const SLIDE_MS = 450;

/**
 * Album trượt ngang.
 *
 * Mỗi ảnh đặt theo khoảng cách vòng tròn tới ảnh đang xem, không xếp thành một
 * dải dài: từ ảnh cuối sang ảnh đầu vẫn trượt đúng một nấc về bên trái, thay vì
 * tua ngược qua cả album. Chỉ ảnh sát cạnh mới có transition — ảnh ở xa đổi chỗ
 * tức thì, vì đằng nào nó cũng nằm ngoài khung.
 *
 * Tự chạy dừng lại khi khách đang chạm (vuốt ảnh lớn, kéo dải ảnh nhỏ) và chờ
 * thêm một lúc sau đó — ảnh vừa chọn mà bị giật sang ảnh khác ngay thì khách
 * không kịp nhìn. Cũng dừng khi album ra khỏi màn hình, để không chạy ngầm.
 */
function Carousel({ node }: NodeProps<'Gallery'>) {
  const { assetBase, dpr, mode, scale } = useRuntime();
  const p = node.props;
  const n = p.photos.length;
  const interval = Math.max(p.autoplayInterval, 800);

  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const current = p.photos[index] ?? p.photos[0]!;

  /** Độ lệch đang kéo, tính theo bề rộng khung; null = không kéo */
  const [drag, setDrag] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const holdUntil = useRef(0);
  const gesture = useRef<{ x: number; y: number; w: number; axis: 'x' | 'y' | null } | null>(null);
  const swiped = useRef(false);
  const stripDrag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  /** Ảnh đã từng tới gần khung — giữ src để lướt lại không phải tải lại */
  const seen = useRef(new Set<number>());

  const hold = () => {
    holdUntil.current = Date.now() + interval * 2;
  };
  const go = (delta: number) => setIndex((i) => (((i + delta) % n) + n) % n);

  useEffect(() => {
    const el = viewport.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!p.autoplay || mode !== 'render' || n < 2 || !visible || drag !== null || fullscreen) return;
    let timer = setTimeout(function tick() {
      const wait = holdUntil.current - Date.now();
      if (wait > 0 || document.hidden) {
        timer = setTimeout(tick, Math.max(wait, interval));
        return;
      }
      setIndex((i) => (i + 1) % n);
    }, interval);
    return () => clearTimeout(timer);
  }, [p.autoplay, mode, n, visible, drag, fullscreen, index, interval]);

  // Đưa ảnh nhỏ đang chọn vào giữa dải. Không dùng scrollIntoView: nó cuộn luôn
  // cả trang theo chiều dọc, kéo khách khỏi chỗ đang đọc.
  useEffect(() => {
    const el = strip.current;
    const thumb = el?.children[index] as HTMLElement | undefined;
    if (!el || !thumb || stripDrag.current) return;
    el.scrollTo({ left: thumb.offsetLeft - (el.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
  }, [index]);

  const interactive = mode === 'render' && n > 1;
  const thumbH = 64;
  const thumbW = 48;

  return (
    <>
      <NodeShell id={node.id} p={p} innerStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          ref={viewport}
          onPointerDown={(e) => {
            if (!interactive) return;
            const r = e.currentTarget.getBoundingClientRect();
            gesture.current = { x: e.clientX, y: e.clientY, w: r.width, axis: null };
            swiped.current = false;
            hold();
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (!g) return;
            const dx = e.clientX - g.x;
            const dy = e.clientY - g.y;
            if (!g.axis) {
              if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                g.axis = 'x';
                // Giữ ngón tay cho album kể cả khi trượt ra ngoài khung
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // pointer đã kết thúc trước khi kịp bắt — bỏ qua, vẫn kéo được
                }
              } else if (Math.abs(dy) > 8) {
                g.axis = 'y';
              }
            }
            if (g.axis === 'x') {
              swiped.current = true;
              setDrag(Math.max(-1, Math.min(1, dx / g.w)));
            }
          }}
          onPointerUp={() => {
            if (drag !== null) {
              if (drag < -SWIPE_THRESHOLD) go(1);
              else if (drag > SWIPE_THRESHOLD) go(-1);
            }
            gesture.current = null;
            setDrag(null);
            hold();
          }}
          onPointerCancel={() => {
            gesture.current = null;
            setDrag(null);
          }}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            borderRadius: 8,
            // Để trình duyệt vẫn cuộn trang theo chiều dọc; chiều ngang thuộc về album
            touchAction: 'pan-y',
          }}
        >
          {p.photos.map((photo, i) => {
            let offset = (((i - index) % n) + n) % n;
            if (offset > n / 2) offset -= n;
            const near = Math.abs(offset) <= 1;
            if (Math.abs(offset) <= 2) seen.current.add(i);
            const show = mode === 'editor' ? i === index : seen.current.has(i);
            return (
              <div
                key={photo.id}
                aria-hidden={i !== index}
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `translateX(${(offset + (drag ?? 0)) * 100}%)`,
                  transition: near && drag === null ? `transform ${SLIDE_MS}ms cubic-bezier(.22,.61,.36,1)` : 'none',
                }}
              >
                {show && (
                  <img
                    src={imageUrl(assetBase, photo.imageKey, p.width * scale, dpr)}
                    srcSet={imageSrcSet(assetBase, photo.imageKey, p.width * scale)}
                    alt={photo.alt}
                    draggable={false}
                    onClick={() => {
                      if (swiped.current) return;
                      if (p.showFullscreenButton && mode === 'render') setFullscreen(true);
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      userSelect: 'none',
                      cursor: p.showFullscreenButton ? 'zoom-in' : undefined,
                    }}
                  />
                )}
              </div>
            );
          })}
          {p.showNavButtons && n > 1 && (
            <>
              <NavButton side="left" onClick={() => { hold(); go(-1); }} />
              <NavButton side="right" onClick={() => { hold(); go(1); }} />
            </>
          )}
        </div>

        {p.showThumbnails && (
          <div
            ref={strip}
            onPointerDown={(e) => {
              hold();
              // Cảm ứng thì trình duyệt tự cuộn dải; chuột thì phải tự làm
              if (e.pointerType === 'mouse') {
                stripDrag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
              }
            }}
            onPointerMove={(e) => {
              const d = stripDrag.current;
              if (!d) return;
              const dx = e.clientX - d.x;
              if (Math.abs(dx) > 4) d.moved = true;
              e.currentTarget.scrollLeft = d.left - dx / (scale || 1);
            }}
            onPointerUp={() => {
              // Để click ngay sau đó còn đọc được `moved`
              setTimeout(() => { stripDrag.current = null; }, 0);
              hold();
            }}
            onPointerLeave={() => { stripDrag.current = null; }}
            onTouchStart={hold}
            onScroll={() => { if (stripDrag.current || Date.now() < holdUntil.current) hold(); }}
            style={{
              position: 'relative',
              display: 'flex',
              gap: 6,
              height: thumbH,
              overflowX: 'auto',
              overflowY: 'hidden',
              flexShrink: 0,
              scrollbarWidth: 'none',
              padding: '0 2px',
            }}
          >
            {p.photos.map((photo, i) => (
              <img
                key={photo.id}
                src={imageUrl(assetBase, photo.imageKey, thumbW * scale, dpr)}
                alt=""
                draggable={false}
                loading={mode === 'editor' ? 'eager' : 'lazy'}
                onClick={() => {
                  if (stripDrag.current?.moved) return;
                  hold();
                  setIndex(() => i);
                }}
                style={{
                  width: thumbW,
                  height: thumbH - 6,
                  marginTop: 3,
                  objectFit: 'cover',
                  borderRadius: 4,
                  flexShrink: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'opacity 200ms, transform 200ms',
                  opacity: i === index ? 1 : 0.5,
                  transform: i === index ? 'scale(1.06)' : 'none',
                  // Vòng trắng thấy được trên nền tối, vòng xám bên ngoài thấy được trên nền trắng
                  boxShadow: i === index ? '0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)' : 'none',
                }}
              />
            ))}
          </div>
        )}
      </NodeShell>

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.9)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <img
            src={imageUrl(assetBase, current.imageKey, 1080, dpr)}
            alt={current.alt}
            style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain' }}
          />
        </div>
      )}
    </>
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Ảnh trước' : 'Ảnh sau'}
      style={{
        position: 'absolute',
        top: '50%',
        [side]: 6,
        transform: 'translateY(-50%)',
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(0,0,0,0.35)',
        color: '#fff',
        fontSize: 16,
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  );
}

export function VideoNode({ node }: NodeProps<'Video'>) {
  const { assetBase, dpr, mode, scale } = useRuntime();
  const p = node.props;

  if (mode === 'editor') {
    return (
      <NodeShell id={node.id} p={p}>
        <EmptySlot label={p.source.kind === 'youtube' ? `YouTube: ${p.source.id || '—'}` : 'Video'} />
      </NodeShell>
    );
  }

  if (p.source.kind === 'youtube') {
    // loop của YouTube chỉ có tác dụng khi playlist trỏ về chính video đó
    const params = new URLSearchParams({
      autoplay: p.autoplay ? '1' : '0',
      mute: p.muted ? '1' : '0',
      loop: p.loop ? '1' : '0',
      playlist: p.source.id,
    });
    return (
      <NodeShell id={node.id} p={p}>
        <iframe
          title="video"
          src={`https://www.youtube-nocookie.com/embed/${p.source.id}?${params}`}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{ width: '100%', height: '100%', border: 0, borderRadius: 'inherit' }}
        />
      </NodeShell>
    );
  }

  return (
    <NodeShell id={node.id} p={p}>
      <video
        src={imageUrl(assetBase, p.source.key, p.width * scale, dpr, { format: 'auto' })}
        poster={p.poster ? imageUrl(assetBase, p.poster, p.width * scale, dpr) : undefined}
        autoPlay={p.autoplay}
        loop={p.loop}
        muted={p.muted}
        playsInline
        controls
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
      />
    </NodeShell>
  );
}
