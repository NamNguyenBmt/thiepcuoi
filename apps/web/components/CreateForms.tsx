'use client';

/**
 * Hai form tạo mới trên trang quản lý.
 *
 * Tạo mẫu xong thì mở thẳng editor — không ai tạo mẫu để đấy. Tạo thiệp xong
 * thì vào form điền nội dung, cũng vì lý do tương tự.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export interface TemplateOption {
  id: string;
  name: string;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Lỗi ${res.status}`);
  return data;
}

export function CreateTemplateForm({
  templates,
  editorUrl,
}: {
  templates: TemplateOption[];
  editorUrl: string;
}) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await postJson('/api/templates', {
        name,
        ...(from ? { fromTemplateId: from } : {}),
      });
      window.location.href = `${editorUrl}?template=${saved.slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={row}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên mẫu mới"
        required
        style={{ ...input, flex: 1 }}
      />
      <select value={from} onChange={(e) => setFrom(e.target.value)} style={input}>
        <option value="">Canvas trống</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            Nhân bản: {t.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy} style={primary}>
        {busy ? 'Đang tạo…' : 'Tạo mẫu'}
      </button>
      {error && <span style={errorStyle}>{error}</span>}
    </form>
  );
}

export function CreateInviteForm({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await postJson('/api/invites', { templateId });
      router.push(`/quan-ly/thiep/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (templates.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>Chưa có mẫu nào để tạo thiệp.</p>;
  }

  return (
    <form onSubmit={onSubmit} style={row}>
      <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ ...input, flex: 1 }}>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy} style={primary}>
        {busy ? 'Đang tạo…' : 'Tạo thiệp'}
      </button>
      {error && <span style={errorStyle}>{error}</span>}
    </form>
  );
}

const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as const;

const input = {
  padding: '7px 9px',
  border: '1px solid #d8dbe0',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
} as const;

const primary = {
  padding: '7px 14px',
  border: 'none',
  borderRadius: 6,
  background: '#7a2c2c',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const errorStyle = { color: '#b42318', fontSize: 12 } as const;
