/**
 * Thư viện ảnh: gọi API + một store nhỏ để mở hộp chọn ảnh theo kiểu await.
 *
 * `pickAsset()` trả về Promise nên chỗ gọi viết thẳng một dòng:
 *   const keys = await pickAsset();
 * thay vì rải callback và state "đang mở modal cho field nào" khắp Inspector.
 */

import { create } from 'zustand';

export interface Asset {
  id: string;
  key: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string;
  createdAt: string;
}

export interface UploadResult {
  saved: Asset[];
  failed: Array<{ name: string; error: string }>;
}

export async function listAssets(): Promise<Asset[]> {
  const res = await fetch('/api/assets');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function uploadAssets(files: File[]): Promise<UploadResult> {
  const form = new FormData();
  for (const f of files) form.append('file', f);

  const res = await fetch('/api/assets', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as UploadResult | { error: string } | null;

  if (!body) throw new Error(`HTTP ${res.status}`);
  if ('error' in body) throw new Error(body.error);
  return body;
}

/** URL xem trước — nhờ proxy của Vite nên đường dẫn tương đối này tới đúng web */
export function thumbUrl(key: string, width = 160): string {
  return `/api/assets/${key}?resize=${width}x&format=webp&quality=80`;
}

interface PickerState {
  open: boolean;
  multiple: boolean;
  resolve: ((keys: string[] | null) => void) | null;
  close: (keys: string[] | null) => void;
}

export const useAssetPicker = create<PickerState>((set, get) => ({
  open: false,
  multiple: false,
  resolve: null,
  close: (keys) => {
    get().resolve?.(keys);
    set({ open: false, resolve: null });
  },
}));

/** Mở hộp chọn ảnh. null = người dùng đóng mà không chọn gì. */
export function pickAsset(options: { multiple?: boolean } = {}): Promise<string[] | null> {
  return new Promise((resolve) => {
    useAssetPicker.setState({ open: true, multiple: options.multiple ?? false, resolve });
  });
}
