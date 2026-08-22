'use client';

/**
 * Ô ảnh cho form thiệp: chọn file → upload luôn → giữ lại AssetKey.
 *
 * Upload ngay lúc chọn (không đợi bấm Lưu) để người dùng thấy ảnh mình vừa
 * chọn; nếu họ bỏ dở thì cùng lắm thừa một file trong kho, đổi lại là biết ngay
 * ảnh có lên được hay không.
 */

import { useRef, useState } from 'react';

export function ImageInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/assets', { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      if (body.saved?.[0]) onChange(body.saved[0].key);
      else throw new Error(body.failed?.[0]?.error ?? 'Không tải lên được');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {value ? (
          <img
            src={`/api/assets/${value}?resize=160x&format=webp&quality=80`}
            alt=""
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, background: '#f1f5f9' }}
          />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 6, background: '#f1f5f9' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={btn}>
            {busy ? 'Đang tải…' : value ? 'Đổi ảnh' : 'Chọn ảnh'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} style={btn}>
              Bỏ ảnh
            </button>
          )}
        </div>
        {error && <span style={{ color: '#b42318', fontSize: 12 }}>{error}</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

const btn = {
  padding: '4px 10px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
} as const;
