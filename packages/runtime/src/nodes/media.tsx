import { useState } from 'react';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl, imageSrcSet } from '../image';
import { EmptySlot } from './basic';

export function GalleryNode({ node }: NodeProps<'Gallery'>) {
  const { assetBase, dpr, mode, scale } = useRuntime();
  const p = node.props;
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

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

  const current = p.photos[index] ?? p.photos[0]!;
  const step = (delta: number) => setIndex((i) => (i + delta + p.photos.length) % p.photos.length);
  const thumbRow = p.showThumbnails ? 64 : 0;

  return (
    <>
      <NodeShell id={node.id} p={p} innerStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <img
            src={imageUrl(assetBase, current.imageKey, p.width * scale, dpr)}
            srcSet={imageSrcSet(assetBase, current.imageKey, p.width * scale)}
            alt={current.alt}
            loading={mode === 'editor' ? 'eager' : 'lazy'}
            onClick={() => p.showFullscreenButton && mode === 'render' && setFullscreen(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 8,
              display: 'block',
              cursor: p.showFullscreenButton ? 'zoom-in' : undefined,
            }}
          />
          {p.showNavButtons && p.photos.length > 1 && (
            <>
              <NavButton side="left" onClick={() => step(-1)} />
              <NavButton side="right" onClick={() => step(1)} />
            </>
          )}
        </div>

        {p.showThumbnails && (
          <div style={{ display: 'flex', gap: 6, height: thumbRow, overflowX: 'auto', flexShrink: 0 }}>
            {p.photos.map((photo, i) => (
              <img
                key={photo.id}
                src={imageUrl(assetBase, photo.imageKey, 80, dpr)}
                alt=""
                onClick={() => setIndex(i)}
                style={{
                  width: thumbRow,
                  height: thumbRow,
                  objectFit: 'cover',
                  borderRadius: 4,
                  flexShrink: 0,
                  cursor: 'pointer',
                  opacity: i === index ? 1 : 0.55,
                  outline: i === index ? '2px solid rgba(255,255,255,0.9)' : 'none',
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
