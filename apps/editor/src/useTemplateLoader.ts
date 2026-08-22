/**
 * Nạp mẫu từ server khi mở editor.
 *
 * Không chặn giao diện: nếu web chưa chạy hoặc gọi lỗi thì vẫn có doc mẫu cục bộ
 * để nghịch, chỉ khác là nút Lưu tắt đi (không có `templateId` thì lưu đi đâu).
 * Mẫu mở theo `?template=<slug|id>`, không có thì lấy mẫu đầu danh sách.
 */

import { useEffect, useState } from 'react';
import { listTemplates, loadTemplate } from './api';
import { useEditor } from './store';

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; name: string }
  | { kind: 'offline'; reason: string };

export function useTemplateLoader(): LoadState {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const wanted = new URLSearchParams(window.location.search).get('template');
        const rows = await listTemplates();
        const row = wanted ? rows.find((t) => t.slug === wanted || t.id === wanted) : rows[0];
        if (!row) throw new Error(wanted ? `Không có mẫu "${wanted}"` : 'Server chưa có mẫu nào');

        const loaded = await loadTemplate(row.id);
        if (cancelled) return;
        useEditor.getState().loadTemplate(loaded.doc, loaded.id, loaded.revision);
        setState({ kind: 'ready', name: loaded.name });
      } catch (err) {
        if (!cancelled) setState({ kind: 'offline', reason: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
