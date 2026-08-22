/**
 * Khung vẽ của editor.
 *
 * Bên dưới là CanvasRenderer y hệt trang thiệp công khai (mode: 'editor'),
 * bên trên là một lớp overlay trong suốt lo việc chọn / kéo / co giãn. Renderer
 * không hề biết đến editor — đó là điều kiện để WYSIWYG không bao giờ lệch.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CanvasRenderer, RuntimeProvider } from '@thiepcuoi/runtime';
import type { TemplateDoc, TemplateNode } from '@thiepcuoi/schema';
import { useEditor } from '../store';
import { snap, boundingRect } from './snapping';
import type { Guide, Rect } from './snapping';

const SNAP_THRESHOLD = 5;

type DragMode =
  | { kind: 'none' }
  | { kind: 'move'; startX: number; startY: number; appliedX: number; appliedY: number }
  | { kind: 'resize'; handle: Handle; startX: number; startY: number; origin: Rect; id: string }
  | { kind: 'marquee'; startX: number; startY: number; x: number; y: number };

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function EditorCanvas() {
  const doc = useEditor((s) => s.history.present);
  const zoom = useEditor((s) => s.zoom);
  const selection = useEditor((s) => s.selection);
  const hoverId = useEditor((s) => s.hoverId);
  const store = useEditor;

  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragMode>({ kind: 'none' });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  // Node theo đúng thứ tự vẽ: zIndex trước, thứ tự trong order sau
  const painted = useMemo(() => paintOrder(doc), [doc]);

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const box = stageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - box.left) / zoom, y: (e.clientY - box.top) / zoom };
  };

  const hitTest = (x: number, y: number): TemplateNode | null => {
    for (let i = painted.length - 1; i >= 0; i--) {
      const node = painted[i]!;
      const p = node.props;
      if (p.locked || p.hidden) continue;
      if (x >= p.left && x <= p.left + p.width && y >= p.top && y <= p.top + p.height) return node;
    }
    return null;
  };

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const { x, y } = toCanvas(e);
    const hit = hitTest(x, y);
    capture(e);

    if (!hit) {
      if (!e.shiftKey) store.getState().select([]);
      drag.current = { kind: 'marquee', startX: x, startY: y, x, y };
      return;
    }

    const current = store.getState().selection;
    if (e.shiftKey) store.getState().toggleSelect(hit.id);
    else if (!current.includes(hit.id)) store.getState().select([hit.id]);

    drag.current = { kind: 'move', startX: x, startY: y, appliedX: 0, appliedY: 0 };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (state.kind === 'none') {
      const { x, y } = toCanvas(e);
      const hit = hitTest(x, y);
      if (hit?.id !== store.getState().hoverId) store.getState().setHover(hit?.id ?? null);
      return;
    }

    const { x, y } = toCanvas(e);

    if (state.kind === 'marquee') {
      drag.current = { ...state, x, y };
      setMarquee(normalize(state.startX, state.startY, x, y));
      return;
    }

    if (state.kind === 'move') {
      const sel = store.getState().selectedNodes();
      if (sel.length === 0) return;
      const rects = sel.map((n) => rectOf(n));
      const bounds = boundingRect(rects)!;

      let dx = x - state.startX;
      let dy = y - state.startY;

      // Snap tính trên khung bao đã dời, so với node KHÔNG được chọn
      const moved: Rect = { ...bounds, left: bounds.left + dx, top: bounds.top + dy };
      const others = painted.filter((n) => !sel.some((s) => s.id === n.id)).map(rectOf);
      const s = snap(moved, others, doc.canvas.baseWidth, SNAP_THRESHOLD / zoom);
      dx += s.dx;
      dy += s.dy;
      setGuides(s.guides);

      store.getState().moveSelected(dx - state.appliedX, dy - state.appliedY, 'drag');
      drag.current = { ...state, appliedX: dx, appliedY: dy };
      return;
    }

    if (state.kind === 'resize') {
      const dx = x - state.startX;
      const dy = y - state.startY;
      const next = resizeRect(state.origin, state.handle, dx, dy, e.shiftKey);
      store.getState().updateProps(state.id, next as any, { coalesceKey: `resize:${state.id}` });
    }
  }

  function onPointerUp() {
    const state = drag.current;
    if (state.kind === 'marquee' && marquee) {
      const inside = painted.filter((n) => {
        const r = rectOf(n);
        return (
          !n.props.locked &&
          r.left >= marquee.left &&
          r.top >= marquee.top &&
          r.left + r.width <= marquee.left + marquee.width &&
          r.top + r.height <= marquee.top + marquee.height
        );
      });
      store.getState().select(inside.map((n) => n.id));
    }
    drag.current = { kind: 'none' };
    setGuides([]);
    setMarquee(null);
  }

  function startResize(e: ReactPointerEvent<HTMLDivElement>, handle: Handle, node: TemplateNode) {
    e.stopPropagation();
    capture(e);
    const { x, y } = toCanvas(e);
    drag.current = { kind: 'resize', handle, startX: x, startY: y, origin: rectOf(node), id: node.id };
  }

  const selectedNodes = selection.map((id) => doc.nodes[id]).filter(Boolean) as TemplateNode[];
  const single = selectedNodes.length === 1 ? selectedNodes[0]! : null;
  const bounds = boundingRect(selectedNodes.map(rectOf));

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'grid', placeItems: 'start center', padding: 24 }}>
      <div
        ref={stageRef}
        style={{
          position: 'relative',
          width: doc.canvas.baseWidth * zoom,
          minHeight: doc.canvas.height * zoom,
          boxShadow: '0 2px 24px rgba(0,0,0,0.14)',
          background: '#fff',
        }}
      >
        <RuntimeProvider value={{ mode: 'editor', assetBase: ASSET_BASE, data: null }}>
          <CanvasRenderer doc={doc} />
        </RuntimeProvider>

        {/* ranh giới section: chỉ để nhìn, không bắt chuột */}
        {doc.sections.map((s) => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              top: s.top * zoom,
              left: 0,
              width: '100%',
              height: s.height * zoom,
              borderTop: '1px dashed rgba(90,110,255,0.5)',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 4,
                fontSize: 10,
                color: 'rgba(70,90,220,0.85)',
                background: 'rgba(255,255,255,0.75)',
                padding: '0 4px',
                borderRadius: 3,
              }}
            >
              {s.name}
            </span>
          </div>
        ))}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ position: 'absolute', inset: 0, zIndex: 100000, cursor: 'default', touchAction: 'none' }}
        >
          {hoverId && !selection.includes(hoverId) && doc.nodes[hoverId] && (
            <Outline rect={rectOf(doc.nodes[hoverId]!)} zoom={zoom} color="rgba(90,110,255,0.5)" />
          )}

          {bounds && <Outline rect={bounds} zoom={zoom} color="#3b6cff" />}

          {single &&
            !single.props.locked &&
            HANDLES.map((h) => (
              <div
                key={h}
                onPointerDown={(e) => startResize(e, h, single)}
                style={{
                  position: 'absolute',
                  width: 9,
                  height: 9,
                  background: '#fff',
                  border: '1.5px solid #3b6cff',
                  borderRadius: 2,
                  cursor: `${h}-resize`,
                  ...handlePosition(h, rectOf(single), zoom),
                }}
              />
            ))}

          {guides.map((g, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                background: '#ff3b6c',
                pointerEvents: 'none',
                ...(g.axis === 'x'
                  ? { left: g.at * zoom, top: g.from * zoom, width: 1, height: (g.to - g.from) * zoom }
                  : { top: g.at * zoom, left: g.from * zoom, height: 1, width: (g.to - g.from) * zoom }),
              }}
            />
          ))}

          {marquee && (
            <div
              style={{
                position: 'absolute',
                left: marquee.left * zoom,
                top: marquee.top * zoom,
                width: marquee.width * zoom,
                height: marquee.height * zoom,
                border: '1px solid #3b6cff',
                background: 'rgba(59,108,255,0.08)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Đường dẫn tương đối: proxy của Vite đưa /api sang apps/web */
export const ASSET_BASE = '/api/assets';

function Outline({ rect, zoom, color }: { rect: Rect; zoom: number; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.left * zoom,
        top: rect.top * zoom,
        width: rect.width * zoom,
        height: rect.height * zoom,
        outline: `1.5px solid ${color}`,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * setPointerCapture ném lỗi nếu pointerId không còn "đang hoạt động" — xảy ra
 * với sự kiện tổng hợp và với chuột bị nhả ngoài cửa sổ. Mất capture chỉ làm
 * kéo kém mượt, không đáng để hỏng cả thao tác.
 */
function capture(e: ReactPointerEvent<HTMLElement>) {
  try {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* bỏ qua */
  }
}

function rectOf(node: TemplateNode): Rect {
  const { top, left, width, height } = node.props;
  return { top, left, width, height };
}

function paintOrder(doc: TemplateDoc): TemplateNode[] {
  return doc.order
    .map((id, i) => ({ node: doc.nodes[id], i }))
    .filter((x): x is { node: TemplateNode; i: number } => Boolean(x.node))
    .sort((a, b) => a.node.props.zIndex - b.node.props.zIndex || a.i - b.i)
    .map((x) => x.node);
}

function normalize(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Giữ Shift để khoá tỉ lệ — cần cho ảnh chân dung */
function resizeRect(o: Rect, handle: Handle, dx: number, dy: number, keepRatio: boolean): Rect {
  let { left, top, width, height } = o;
  if (handle.includes('e')) width = o.width + dx;
  if (handle.includes('s')) height = o.height + dy;
  if (handle.includes('w')) {
    width = o.width - dx;
    left = o.left + dx;
  }
  if (handle.includes('n')) {
    height = o.height - dy;
    top = o.top + dy;
  }
  if (keepRatio && o.width > 0 && o.height > 0) {
    const ratio = o.width / o.height;
    if (Math.abs(width - o.width) > Math.abs(height - o.height)) height = width / ratio;
    else width = height * ratio;
  }
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.max(8, Math.round(width)),
    height: Math.max(8, Math.round(height)),
  };
}

function handlePosition(h: Handle, r: Rect, zoom: number) {
  const x = { w: r.left, e: r.left + r.width, '': r.left + r.width / 2 };
  const y = { n: r.top, s: r.top + r.height, '': r.top + r.height / 2 };
  const hx = (h.includes('w') ? x.w : h.includes('e') ? x.e : x['']) * zoom;
  const hy = (h.includes('n') ? y.n : h.includes('s') ? y.s : y['']) * zoom;
  return { left: hx - 4.5, top: hy - 4.5 };
}

/** Bàn phím: xoá, nhích, undo/redo, copy/paste, nhân bản */
export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        s.copySelected();
      } else if (mod && e.key.toLowerCase() === 'v') {
        s.paste();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteSelected();
      } else if (e.key === 'Escape') {
        s.select([]);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }[e.key] ?? [0, 0];
        s.moveSelected(dx, dy, 'nudge');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
