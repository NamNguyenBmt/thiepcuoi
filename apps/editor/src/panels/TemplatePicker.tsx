/**
 * Chọn mẫu đang mở, hoặc tạo mẫu mới.
 *
 * Đổi mẫu là vứt toàn bộ lịch sử undo của mẫu cũ, nên hỏi lại nếu người dùng đã
 * sửa gì đó — mất công kéo thả cả buổi vì lỡ tay chọn nhầm là quá đắt.
 */

import { useCallback, useEffect, useState } from 'react';
import { createTemplate, listTemplates, loadTemplate } from '../api';
import type { TemplateSummary } from '../api';
import { useEditor } from '../store';
import { useSession } from '../session';

export function TemplatePicker() {
  const templateId = useEditor((s) => s.templateId);
  const dirty = useEditor((s) => s.history.past.length > 0);
  const user = useSession((s) => s.user);

  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listTemplates());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user]);

  async function open(id: string) {
    if (!id || id === templateId) return;
    if (dirty && !confirm('Thay đổi chưa lưu sẽ mất. Vẫn mở mẫu khác?')) return;
    setBusy(true);
    try {
      const loaded = await loadTemplate(id);
      useEditor.getState().loadTemplate(loaded.doc, loaded.id, loaded.revision);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const name = prompt('Tên mẫu mới:');
    if (!name?.trim()) return;
    const duplicate = templateId ? confirm('Nhân bản từ mẫu đang mở? (Huỷ = canvas trống)') : false;
    setBusy(true);
    try {
      const created = await createTemplate(name.trim(), duplicate && templateId ? templateId : undefined);
      await refresh();
      const loaded = await loadTemplate(created.id);
      useEditor.getState().loadTemplate(loaded.doc, loaded.id, loaded.revision);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <select
        value={templateId ?? ''}
        onChange={(e) => void open(e.target.value)}
        disabled={busy || items.length === 0}
        style={select}
        title="Mẫu đang mở"
      >
        {templateId === null && <option value="">(doc cục bộ)</option>}
        {items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button onClick={() => void create()} disabled={busy || !user} style={btn} title={user ? 'Tạo mẫu mới' : 'Cần đăng nhập'}>
        + Mẫu mới
      </button>
    </span>
  );
}

const select = {
  padding: '4px 6px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  maxWidth: 160,
} as const;

const btn = {
  padding: '4px 8px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
} as const;
