/**
 * Thanh công cụ trên cùng: thêm node, undo/redo, zoom, kiểm tra, lưu.
 *
 * Danh sách nút "thêm" sinh thẳng từ NODE_REGISTRY của runtime, nên không bao
 * giờ có chuyện schema hỗ trợ một loại node mà editor quên đưa vào thanh công cụ.
 */

import { useState } from 'react';
import { NODE_REGISTRY } from '@thiepcuoi/runtime';
import { validateDoc } from '@thiepcuoi/schema';
import type { NodeType } from '@thiepcuoi/schema';
import { useEditor } from '../store';
import { ApiError, saveTemplate } from '../api';
import { pickAsset } from '../assets';
import { SessionBar } from './SessionBar';
import { TemplatePicker } from './TemplatePicker';

const LABEL: Record<NodeType, string> = {
  Text: 'Chữ', Photo: 'Ảnh', Shape: 'Hoạ tiết', Calendar: 'Lịch', CountDown: 'Đếm ngược',
  RsvpForm: 'Form', Gallery: 'Album', GiftQr: 'Mừng cưới', Map: 'Chỉ đường', Wishes: 'Lưu bút', Video: 'Video',
};

export function Toolbar() {
  const addNode = useEditor((s) => s.addNode);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.history.past.length);
  const future = useEditor((s) => s.history.future.length);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const doc = useEditor((s) => s.history.present);
  const selection = useEditor((s) => s.selection);
  const duplicate = useEditor((s) => s.duplicateSelected);
  const remove = useEditor((s) => s.deleteSelected);

  const templateId = useEditor((s) => s.templateId);
  const revision = useEditor((s) => s.revision);
  const markSaved = useEditor((s) => s.markSaved);

  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const issues = validateDoc(doc);
  const errors = issues.filter((i) => i.level === 'error');

  async function save() {
    // Chặn sớm ở client cho phản hồi nhanh; server vẫn validate lại lần nữa
    if (errors.length > 0) {
      setStatus(`Không lưu được: ${errors.length} lỗi — ${errors[0]!.path}: ${errors[0]!.message}`);
      return;
    }
    if (!templateId || revision == null) {
      setStatus('Chưa gắn với mẫu nào trên server, không có chỗ để lưu.');
      return;
    }

    setSaving(true);
    setStatus('Đang lưu…');
    try {
      const saved = await saveTemplate(templateId, doc, revision);
      markSaved(saved.revision);
      setStatus(`Đã lưu · bản ${saved.revision}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStatus('Mẫu đã bị lưu ở tab khác. Tải lại trang trước khi lưu tiếp, nếu không bạn sẽ đè mất thay đổi của họ.');
      } else if (err instanceof ApiError && err.status === 401) {
        setStatus('Chưa đăng nhập — đăng nhập ở góc trên bên phải rồi lưu lại.');
      } else if (err instanceof ApiError && err.status === 403) {
        setStatus('Mẫu này không phải của bạn nên không lưu được.');
      } else if (err instanceof ApiError && err.status === 422) {
        const first = (err.payload as { issues?: Array<{ path: string; message: string }> })?.issues?.[0];
        setStatus(`Server từ chối: ${first ? `${first.path} — ${first.message}` : err.message}`);
      } else {
        setStatus(`Lưu lỗi: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: '#fff',
        borderBottom: '1px solid #e6e8eb',
        flexWrap: 'wrap',
      }}
    >
      <TemplatePicker />

      <Divider />

      {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => (
        <button key={type} onClick={() => addNode(type)} style={btn} title={`Thêm ${LABEL[type]}`}>
          + {LABEL[type]}
        </button>
      ))}

      <Divider />

      <button onClick={undo} disabled={past === 0} style={btn} title="Ctrl+Z">
        ↶ Hoàn tác{past > 0 ? ` (${past})` : ''}
      </button>
      <button onClick={redo} disabled={future === 0} style={btn} title="Ctrl+Shift+Z">
        ↷ Làm lại
      </button>

      <Divider />

      <button onClick={duplicate} disabled={selection.length === 0} style={btn} title="Ctrl+D">
        Nhân bản
      </button>
      <button onClick={remove} disabled={selection.length === 0} style={btn} title="Delete">
        Xoá
      </button>

      <Divider />

      <button onClick={() => void pickAsset()} style={btn} title="Xem và tải ảnh lên">
        Thư viện ảnh
      </button>

      <Divider />

      <button onClick={() => setZoom(zoom - 0.1)} style={btn}>−</button>
      <span style={{ width: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + 0.1)} style={btn}>+</button>
      <button onClick={() => setZoom(1)} style={btn}>100%</button>

      <div style={{ flex: 1 }} />

      <SessionBar />

      <Divider />

      <span
        style={{ color: errors.length ? '#b42318' : '#067647', fontSize: 12 }}
        title={issues.map((i) => `${i.level}: ${i.path} — ${i.message}`).join('\n')}
      >
        {errors.length ? `${errors.length} lỗi` : 'Hợp lệ'}
        {issues.length - errors.length > 0 ? ` · ${issues.length - errors.length} cảnh báo` : ''}
      </span>

      <button
        onClick={save}
        disabled={saving || !templateId}
        title={templateId ? `Mẫu ${templateId} · bản ${revision}` : 'Chưa nạp được mẫu từ server'}
        style={{
          ...btn,
          background: '#1f2937',
          color: '#fff',
          borderColor: '#1f2937',
          opacity: saving || !templateId ? 0.5 : 1,
        }}
      >
        {saving ? 'Đang lưu…' : 'Lưu'}
      </button>

      {status && <span style={{ width: '100%', color: '#6b7280', fontSize: 11 }}>{status}</span>}
    </header>
  );
}

function Divider() {
  return <span style={{ width: 1, height: 18, background: '#e6e8eb', margin: '0 4px' }} />;
}

const btn = {
  padding: '4px 8px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
} as const;
