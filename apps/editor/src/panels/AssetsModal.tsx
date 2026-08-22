/**
 * Hộp chọn ảnh: kéo thả hoặc bấm để tải lên, bấm ảnh để chọn.
 *
 * Danh sách nạp lại mỗi lần mở — người dùng có thể vừa upload từ tab khác, và
 * đây không phải chỗ đáng để dựng cache.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { listAssets, thumbUrl, uploadAssets, useAssetPicker } from '../assets';
import type { Asset } from '../assets';

export function AssetsModal() {
  const open = useAssetPicker((s) => s.open);
  const multiple = useAssetPicker((s) => s.multiple);
  const close = useAssetPicker((s) => s.close);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setAssets(await listAssets());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(
        msg.includes('401')
          ? 'Cần đăng nhập mới xem được thư viện ảnh (đăng nhập ở thanh công cụ).'
          : `Không đọc được thư viện: ${msg}`,
      );
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setChosen([]);
    setStatus('');
    void refresh();
  }, [open, refresh]);

  // Esc để đóng: modal nào cũng phải có, nếu không người dùng bị kẹt
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setStatus(`Đang tải lên ${files.length} ảnh…`);
    try {
      const result = await uploadAssets(files);
      await refresh();
      const failed = result.failed.length ? ` · ${result.failed.length} lỗi: ${result.failed[0]!.error}` : '';
      setStatus(`Đã tải lên ${result.saved.length} ảnh${failed}`);
      // Ảnh vừa tải lên được chọn sẵn: gần như luôn là thứ người dùng đang cần
      if (result.saved.length > 0) {
        setChosen(multiple ? result.saved.map((a) => a.key) : [result.saved[0]!.key]);
      }
    } catch (err) {
      setStatus(`Tải lên lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void upload([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
  }

  if (!open) return null;

  function toggle(key: string) {
    setChosen((prev) =>
      multiple ? (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]) : [key],
    );
  }

  return (
    <div
      onClick={() => close(null)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: 'rgba(15,23,42,0.5)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          outline: dragging ? '2px dashed #3b6cff' : 'none',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e6e8eb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>Thư viện ảnh</strong>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>
            {multiple ? 'chọn nhiều ảnh' : 'chọn một ảnh'} · kéo thả để tải lên
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={() => inputRef.current?.click()} disabled={busy} style={btn}>
            Tải ảnh lên
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              void upload([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {assets.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              Chưa có ảnh nào. Kéo ảnh vào đây hoặc bấm “Tải ảnh lên”.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {assets.map((a) => {
                const active = chosen.includes(a.key);
                return (
                  <button
                    key={a.key}
                    onClick={() => toggle(a.key)}
                    onDoubleClick={() => close([a.key])}
                    title={`${a.originalName} · ${a.width}×${a.height} · ${(a.bytes / 1024).toFixed(0)} KB`}
                    style={{
                      padding: 0,
                      border: active ? '2px solid #3b6cff' : '1px solid #e6e8eb',
                      borderRadius: 8,
                      background: '#f8fafc',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={thumbUrl(a.key)}
                      alt={a.originalName}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ fontSize: 10, color: '#6b7280', padding: '3px 4px', textAlign: 'left' }}>
                      {a.width}×{a.height}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #e6e8eb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 11, color: '#6b7280' }}>{status}</span>
          <button onClick={() => close(null)} style={btn}>
            Huỷ
          </button>
          <button
            onClick={() => close(chosen)}
            disabled={chosen.length === 0}
            style={{
              ...btn,
              background: '#1f2937',
              color: '#fff',
              borderColor: '#1f2937',
              opacity: chosen.length === 0 ? 0.5 : 1,
            }}
          >
            Chọn{chosen.length > 1 ? ` (${chosen.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: '5px 10px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
} as const;
