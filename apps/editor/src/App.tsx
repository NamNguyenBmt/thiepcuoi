import { EditorCanvas, useKeyboardShortcuts } from './canvas/EditorCanvas';
import { InspectorPanel } from './panels/InspectorPanel';
import { LayersPanel } from './panels/LayersPanel';
import { Toolbar } from './panels/Toolbar';
import { AssetsModal } from './panels/AssetsModal';
import { useTemplateLoader } from './useTemplateLoader';

export function App() {
  useKeyboardShortcuts();
  const load = useTemplateLoader();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {load.kind !== 'ready' && <LoadBanner state={load} />}
      <Toolbar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LayersPanel />
        <EditorCanvas />
        <InspectorPanel />
      </div>
      <AssetsModal />
    </div>
  );
}

function LoadBanner({ state }: { state: { kind: 'loading' } | { kind: 'offline'; reason: string } }) {
  const loading = state.kind === 'loading';
  return (
    <div
      style={{
        padding: '6px 12px',
        fontSize: 12,
        background: loading ? '#eef3ff' : '#fff7ed',
        color: loading ? '#1e40af' : '#9a3412',
        borderBottom: '1px solid #e6e8eb',
      }}
    >
      {loading
        ? 'Đang nạp mẫu từ server…'
        : `Không nạp được mẫu (${state.reason}). Đang chỉnh trên doc mẫu cục bộ — nút Lưu tắt.`}
    </div>
  );
}
