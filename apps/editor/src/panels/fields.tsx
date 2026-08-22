/**
 * Ô nhập của Inspector.
 *
 * Mỗi ô tự quyết định coalesceKey: gõ vào ô số hay kéo thanh trượt sinh ra rất
 * nhiều lần cập nhật liên tiếp, gộp lại thành một bước undo mới dùng được.
 */

import type { ReactNode } from 'react';
import { pickAsset, thumbUrl } from '../assets';

export const S = {
  row: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 } as const,
  label: { width: 78, flexShrink: 0, color: '#6b7280', fontSize: 11 } as const,
  input: {
    flex: 1,
    minWidth: 0,
    padding: '4px 6px',
    border: '1px solid #d8dbe0',
    borderRadius: 4,
    background: '#fff',
  } as const,
  group: { padding: 10, borderBottom: '1px solid #e6e8eb' } as const,
  groupTitle: { fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8, letterSpacing: '0.04em' } as const,
};

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      {children}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Row label={label}>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={S.input}
      />
    </Row>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={S.input} />
    </Row>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <Row label={label}>
      <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} style={{ width: 28, height: 24, padding: 0, border: '1px solid #d8dbe0', borderRadius: 4 }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} style={S.input} />
    </Row>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} style={S.input}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function CheckField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </Row>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Row label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ width: 34, textAlign: 'right', color: '#6b7280', fontSize: 11 }}>
        {Math.round(value * 100) / 100}
      </span>
    </Row>
  );
}

/**
 * Ô chọn ảnh: xem trước + nút mở thư viện.
 *
 * Vẫn giữ ô nhập chuỗi bên dưới: AssetKey của hoạ tiết hệ thống không nằm trong
 * thư viện upload, và khi debug thì gõ thẳng key vẫn là cách nhanh nhất.
 */
export function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  async function choose() {
    const keys = await pickAsset();
    if (keys && keys[0]) onChange(keys[0]);
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={S.row}>
        <span style={S.label}>{label}</span>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          <button type="button" onClick={choose} style={pickBtn}>
            Chọn…
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} style={pickBtn} title="Bỏ ảnh">
              ×
            </button>
          )}
        </div>
      </div>
      {value && (
        <img
          src={thumbUrl(value, 240)}
          alt=""
          style={{
            width: '100%',
            height: 90,
            objectFit: 'contain',
            background: '#f1f5f9',
            borderRadius: 4,
            marginBottom: 4,
          }}
        />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="uploads/… hoặc key hệ thống"
        style={{ ...S.input, width: '100%', fontSize: 11 }}
      />
    </div>
  );
}

const pickBtn = {
  flex: 1,
  padding: '4px 6px',
  border: '1px solid #d8dbe0',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
} as const;
