/**
 * Store của editor.
 *
 * Một store duy nhất giữ doc + lựa chọn + lịch sử. Component đọc qua selector
 * nên chỉ render lại phần liên quan.
 */

import { create } from 'zustand';
import type { NodeType, PropsOf, Section, TemplateDoc, TemplateNode } from '@thiepcuoi/schema';
import { createNode, validateDoc } from '@thiepcuoi/schema';
import type { ValidationIssue } from '@thiepcuoi/schema';
import { initHistory, mutate, redo, undo } from './history';
import type { HistoryState, MutateOptions } from './history';

export interface EditorState {
  history: HistoryState<TemplateDoc>;
  /** null = đang làm việc trên doc mẫu cục bộ, chưa gắn với mẫu nào trên server */
  templateId: string | null;
  revision: number | null;
  selection: string[];
  hoverId: string | null;
  zoom: number;
  clipboard: TemplateNode[];
  issues: ValidationIssue[];

  // đọc
  doc: () => TemplateDoc;
  selectedNodes: () => TemplateNode[];

  // lựa chọn
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setHover: (id: string | null) => void;
  setZoom: (zoom: number) => void;

  // sửa doc
  edit: (recipe: (doc: TemplateDoc) => void, opts?: MutateOptions) => void;
  addNode: (type: NodeType, sectionId?: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  moveSelected: (dx: number, dy: number, coalesceKey?: string) => void;
  updateProps: <T extends NodeType>(id: string, patch: Partial<PropsOf<T>>, opts?: MutateOptions) => void;
  reorder: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  copySelected: () => void;
  paste: () => void;

  // section
  addSection: () => void;
  updateSection: (id: string, patch: Partial<Section>) => void;
  removeSection: (id: string) => void;

  // nạp / lưu
  loadTemplate: (doc: TemplateDoc, templateId: string, revision: number) => void;
  markSaved: (revision: number) => void;

  // lịch sử
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  revalidate: () => void;
}

/** Section chứa toạ độ y này (dùng khi thêm node mới hoặc khi kéo node sang section khác) */
function sectionAt(doc: TemplateDoc, top: number): Section | undefined {
  return doc.sections.find((s) => top >= s.top && top < s.top + s.height) ?? doc.sections[doc.sections.length - 1];
}

export function createEditorStore(initialDoc: TemplateDoc) {
  return create<EditorState>((set, get) => {
    const apply = (recipe: (doc: TemplateDoc) => void, opts?: MutateOptions) =>
      set((s) => ({ history: mutate(s.history, recipe, opts) }));

    return {
      history: initHistory(initialDoc),
      templateId: null,
      revision: null,
      selection: [],
      hoverId: null,
      zoom: 1,
      clipboard: [],
      issues: [],

      doc: () => get().history.present,
      selectedNodes: () => {
        const doc = get().history.present;
        return get().selection.map((id) => doc.nodes[id]).filter(Boolean) as TemplateNode[];
      },

      select: (ids) => set({ selection: ids }),
      toggleSelect: (id) =>
        set((s) => ({
          selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id],
        })),
      setHover: (id) => set({ hoverId: id }),
      setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),

      edit: apply,

      addNode: (type, sectionId) => {
        const doc = get().history.present;
        // Node mới rơi vào giữa section đang xem, lệch xuống một chút cho dễ thấy
        const section = sectionId ? doc.sections.find((s) => s.id === sectionId) : doc.sections[0];
        if (!section) return;
        const node = createNode(type, section.id, {
          top: section.top + 40,
          left: Math.round(doc.canvas.baseWidth / 2 - 100),
          zIndex: nextZIndex(doc),
        } as any);
        apply(
          (d) => {
            d.nodes[node.id] = node;
            d.order.push(node.id);
          },
          { label: `Thêm ${type}` },
        );
        set({ selection: [node.id] });
      },

      deleteSelected: () => {
        const ids = get().selection;
        if (ids.length === 0) return;
        apply(
          (d) => {
            for (const id of ids) {
              delete d.nodes[id];
            }
            d.order = d.order.filter((x) => !ids.includes(x));
          },
          { label: 'Xoá' },
        );
        set({ selection: [] });
      },

      duplicateSelected: () => {
        const doc = get().history.present;
        const ids = get().selection;
        const copies = ids.map((id) => cloneNode(doc.nodes[id]!, 16));
        if (copies.length === 0) return;
        apply(
          (d) => {
            for (const c of copies) {
              d.nodes[c.id] = c;
              d.order.push(c.id);
            }
          },
          { label: 'Nhân bản' },
        );
        set({ selection: copies.map((c) => c.id) });
      },

      moveSelected: (dx, dy, coalesceKey) => {
        const ids = get().selection;
        if (ids.length === 0) return;
        apply(
          (d) => {
            for (const id of ids) {
              const node = d.nodes[id];
              if (!node || node.props.locked) continue;
              node.props.left += dx;
              node.props.top += dy;
              // Kéo qua ranh giới thì node đổi luôn section chủ quản
              const section = sectionAt(d, node.props.top);
              if (section) node.sectionId = section.id;
            }
          },
          { label: 'Di chuyển', coalesceKey: coalesceKey ?? `move:${ids.join(',')}` },
        );
      },

      updateProps: (id, patch, opts) =>
        apply(
          (d) => {
            const node = d.nodes[id];
            if (!node) return;
            Object.assign(node.props, patch);
            if ('top' in patch) {
              const section = sectionAt(d, node.props.top);
              if (section) node.sectionId = section.id;
            }
          },
          { label: 'Sửa thuộc tính', ...opts },
        ),

      reorder: (id, direction) =>
        apply(
          (d) => {
            const node = d.nodes[id];
            if (!node) return;
            const all = Object.values(d.nodes).map((n) => n.props.zIndex);
            const max = Math.max(...all, 0);
            const min = Math.min(...all, 0);
            if (direction === 'front') node.props.zIndex = max + 1;
            else if (direction === 'back') node.props.zIndex = min - 1;
            else node.props.zIndex += direction === 'forward' ? 1 : -1;
          },
          { label: 'Đổi thứ tự' },
        ),

      copySelected: () => set({ clipboard: get().selectedNodes().map((n) => structuredClone(n)) }),

      paste: () => {
        const items = get().clipboard;
        if (items.length === 0) return;
        const copies = items.map((n) => cloneNode(n, 24));
        apply(
          (d) => {
            for (const c of copies) {
              d.nodes[c.id] = c;
              d.order.push(c.id);
            }
          },
          { label: 'Dán' },
        );
        set({ selection: copies.map((c) => c.id) });
      },

      addSection: () =>
        apply(
          (d) => {
            const last = d.sections[d.sections.length - 1];
            const top = last ? last.top + last.height : 0;
            d.sections.push({
              id: `sec-${Date.now().toString(36)}`,
              name: `Phần ${d.sections.length + 1}`,
              top,
              height: 700,
              background: null,
            });
            d.canvas.height = top + 700;
          },
          { label: 'Thêm phần' },
        ),

      updateSection: (id, patch) =>
        apply(
          (d) => {
            const idx = d.sections.findIndex((s) => s.id === id);
            const section = d.sections[idx];
            if (!section) return;
            const oldHeight = section.height;
            Object.assign(section, patch);
            // Đổi chiều cao một section thì mọi section (và node) bên dưới phải
            // dịch theo, nếu không sẽ hở hoặc chồng lên nhau.
            if (patch.height != null && patch.height !== oldHeight) {
              shiftBelow(d, idx, patch.height - oldHeight);
            }
          },
          { label: 'Sửa phần' },
        ),

      removeSection: (id) =>
        apply(
          (d) => {
            const idx = d.sections.findIndex((s) => s.id === id);
            const section = d.sections[idx];
            if (!section || d.sections.length === 1) return;
            const doomed = Object.values(d.nodes).filter((n) => n.sectionId === id).map((n) => n.id);
            for (const nid of doomed) delete d.nodes[nid];
            d.order = d.order.filter((x) => !doomed.includes(x));
            d.sections.splice(idx, 1);
            shiftBelow(d, idx - 1, -section.height);
          },
          { label: 'Xoá phần' },
        ),

      // Nạp mẫu mới thì lịch sử phải làm lại từ đầu: undo về một doc khác hẳn
      // là thứ không ai muốn.
      loadTemplate: (doc, templateId, revision) =>
        set({ history: initHistory(doc), templateId, revision, selection: [], clipboard: [] }),

      markSaved: (revision) => set({ revision }),

      undo: () => set((s) => ({ history: undo(s.history), selection: [] })),
      redo: () => set((s) => ({ history: redo(s.history), selection: [] })),
      canUndo: () => get().history.past.length > 0,
      canRedo: () => get().history.future.length > 0,

      revalidate: () => set({ issues: validateDoc(get().history.present) }),
    };
  });
}

function nextZIndex(doc: TemplateDoc): number {
  const all = Object.values(doc.nodes).map((n) => n.props.zIndex);
  return all.length ? Math.max(...all) + 1 : 0;
}

function cloneNode(node: TemplateNode, offset: number): TemplateNode {
  const copy = structuredClone(node);
  copy.id = crypto.randomUUID();
  copy.props.top += offset;
  copy.props.left += offset;
  return copy;
}

/** Dịch mọi section sau `idx` và node của chúng đi `delta` px */
function shiftBelow(doc: TemplateDoc, idx: number, delta: number) {
  if (!delta) return;
  for (let i = idx + 1; i < doc.sections.length; i++) {
    const s = doc.sections[i]!;
    s.top += delta;
    for (const node of Object.values(doc.nodes)) {
      if (node.sectionId === s.id) node.props.top += delta;
    }
  }
  doc.canvas.height += delta;
}

export type EditorStore = ReturnType<typeof createEditorStore>;
