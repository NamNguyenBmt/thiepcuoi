/**
 * Undo/redo bằng patch của immer.
 *
 * Lưu patch chứ không lưu bản sao doc: kéo một node 200 lần thì lịch sử tốn vài
 * KB thay vì 200 × 120 KB.
 *
 * Gộp thao tác: kéo chuột sinh ra hàng trăm lần cập nhật liên tiếp. Nếu mỗi lần
 * là một bước undo thì người dùng phải Ctrl+Z hàng trăm cái để quay lại. Các
 * thay đổi cùng `coalesceKey` và cách nhau dưới COALESCE_MS được gộp làm một.
 */

import { applyPatches, enablePatches, produceWithPatches } from 'immer';
import type { Patch } from 'immer';

enablePatches();

const COALESCE_MS = 400;
const MAX_HISTORY = 200;

export interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  key: string | null;
  time: number;
  label: string;
}

export interface HistoryState<T> {
  present: T;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export function initHistory<T>(present: T): HistoryState<T> {
  return { present, past: [], future: [] };
}

export interface MutateOptions {
  label?: string;
  /** Cùng key + trong COALESCE_MS ⇒ gộp vào bước trước */
  coalesceKey?: string | null;
  /** Không ghi vào lịch sử (ví dụ: đổi lựa chọn, đổi zoom) */
  skipHistory?: boolean;
}

export function mutate<T>(
  state: HistoryState<T>,
  recipe: (draft: T) => void,
  opts: MutateOptions = {},
): HistoryState<T> {
  const [next, patches, inverse] = produceWithPatches(state.present, recipe);
  if (patches.length === 0) return state;
  if (opts.skipHistory) return { ...state, present: next };

  const now = Date.now();
  const key = opts.coalesceKey ?? null;
  const last = state.past[state.past.length - 1];

  // Gộp: giữ inverse của bước đầu (để undo về đúng điểm xuất phát), nối patches
  if (key && last && last.key === key && now - last.time < COALESCE_MS) {
    const merged: HistoryEntry = {
      patches: [...last.patches, ...patches],
      inverse: [...inverse, ...last.inverse],
      key,
      time: now,
      label: last.label,
    };
    return { present: next, past: [...state.past.slice(0, -1), merged], future: [] };
  }

  const entry: HistoryEntry = { patches, inverse, key, time: now, label: opts.label ?? 'Thay đổi' };
  const past = [...state.past, entry].slice(-MAX_HISTORY);
  return { present: next, past, future: [] };
}

export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  const entry = state.past[state.past.length - 1];
  if (!entry) return state;
  return {
    present: applyPatches(state.present as any, entry.inverse) as T,
    past: state.past.slice(0, -1),
    future: [entry, ...state.future],
  };
}

export function redo<T>(state: HistoryState<T>): HistoryState<T> {
  const entry = state.future[0];
  if (!entry) return state;
  return {
    present: applyPatches(state.present as any, entry.patches) as T,
    past: [...state.past, entry],
    future: state.future.slice(1),
  };
}
