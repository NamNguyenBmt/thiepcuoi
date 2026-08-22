import type { CSSProperties } from 'react';
import { resolveTokens } from '@thiepcuoi/schema';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl, imageSrcSet } from '../image';
import { sanitizeInlineHtml, stripHtml } from '../html';

export function TextNode({ node }: NodeProps<'Text'>) {
  const { mode, data } = useRuntime();
  const p = node.props;

  const html = sanitizeInlineHtml(resolveTokens(p.text, data, mode));

  const typography: CSSProperties = {
    fontFamily: p.fontFamily,
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
    fontStyle: p.fontStyle,
    color: p.color,
    textAlign: p.textAlign,
    lineHeight: p.lineHeight,
    letterSpacing: p.letterSpacing,
    textTransform: p.textTransform,
    textDecoration: p.textDecoration,
    // Chữ trong thiệp luôn canh giữa theo chiều dọc của khung đã kéo
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...(p.textStroke
      ? {
          WebkitTextStrokeWidth: `${p.textStroke.width}px`,
          WebkitTextStrokeColor: p.textStroke.color,
          paintOrder: 'stroke fill',
        }
      : {}),
  };

  return (
    <NodeShell id={node.id} p={p} innerStyle={typography} ariaLabel={stripHtml(html)}>
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </NodeShell>
  );
}

export function PhotoNode({ node }: NodeProps<'Photo'>) {
  const { assetBase, dpr, data, mode, scale } = useRuntime();
  const p = node.props;

  // slot cho phép người dùng cuối thay ảnh mà không đụng tới template
  const key = (p.slot && data?.photos?.[p.slot]) || p.imgKey;
  // px thật trên màn hình = bề rộng thiết kế × scale của canvas
  const renderWidth = p.width * scale;
  const src = imageUrl(assetBase, key, renderWidth, dpr);

  const mask = p.maskShapeImg ? imageUrl(assetBase, p.maskShapeImg, renderWidth, dpr, { format: 'png' }) : null;

  const inner: CSSProperties = mask
    ? {
        WebkitMaskImage: `url("${mask}")`,
        maskImage: `url("${mask}")`,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }
    : {};

  if (!src) {
    return (
      <NodeShell id={node.id} p={p} flipX={p.flipX} flipY={p.flipY} innerStyle={inner}>
        {mode === 'editor' ? <EmptySlot label="Chưa có ảnh" /> : null}
      </NodeShell>
    );
  }

  return (
    <NodeShell id={node.id} p={p} flipX={p.flipX} flipY={p.flipY} innerStyle={inner}>
      <img
        src={src}
        srcSet={imageSrcSet(assetBase, key, renderWidth)}
        alt=""
        // Editor không lazy: canvas nằm trong khung cuộn có transform: scale()
        // nên heuristic lazy-load của trình duyệt không kích hoạt, và người
        // thiết kế vừa gán ảnh xong lại thấy ô trống.
        loading={mode === 'editor' ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: p.objectFit,
          display: 'block',
          borderRadius: 'inherit',
        }}
      />
    </NodeShell>
  );
}

export function ShapeNode({ node }: NodeProps<'Shape'>) {
  const { assetBase, dpr, scale } = useRuntime();
  const p = node.props;

  // 'rect' không có file: khối màu / khung viền vẽ hết bằng baseStyle của
  // NodeShell (backgroundColor, border, borderRadius). Phần lớn hoạ tiết hình
  // học trong một mẫu thiệp là loại này — bắt chúng đi qua một file SVG chỉ để
  // vẽ hình chữ nhật là thêm một request và một chỗ hỏng cho mỗi khối màu.
  const src =
    p.shapeKind === 'rect'
      ? ''
      : imageUrl(assetBase, p.imgKey, p.width * scale, dpr, p.shapeKind === 'svg' ? { format: 'auto' } : {});

  // SVG hoạ tiết được tô lại bằng mask để một file dùng được cho mọi bảng màu
  const inner: CSSProperties =
    p.shapeKind === 'svg' && src
      ? {
          backgroundColor: p.color,
          WebkitMaskImage: `url("${src}")`,
          maskImage: `url("${src}")`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }
      : src
        ? {
            backgroundImage: `url("${src}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }
        : {};

  return <NodeShell id={node.id} p={p} flipX={p.flipX} flipY={p.flipY} innerStyle={inner}>{null}</NodeShell>;
}

export function EmptySlot({ label }: { label: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        border: '1px dashed rgba(0,0,0,0.25)',
        borderRadius: 'inherit',
        color: 'rgba(0,0,0,0.4)',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      {label}
    </div>
  );
}
