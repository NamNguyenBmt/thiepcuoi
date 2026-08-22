/**
 * Panel Layers: cây section → node, kèm nút khoá / ẩn.
 *
 * Danh sách trong mỗi section xếp theo thứ tự vẽ ĐẢO NGƯỢC (node trên cùng nằm
 * đầu danh sách), giống mọi công cụ thiết kế — người dùng đọc từ trên xuống
 * đúng như nhìn vào canvas.
 */

import type { TemplateDoc, TemplateNode } from '@thiepcuoi/schema';
import { useEditor } from '../store';

const TYPE_ICON: Record<string, string> = {
  Text: 'T', Photo: '▣', Shape: '◆', Calendar: '▤', CountDown: '⏱',
  RsvpForm: '✓', Gallery: '❏', GiftQr: '⌗', Map: '⚑', Wishes: '✉', Video: '▶',
};

export function LayersPanel() {
  const doc = useEditor((s) => s.history.present);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const setHover = useEditor((s) => s.setHover);
  const updateProps = useEditor((s) => s.updateProps);
  const addSection = useEditor((s) => s.addSection);
  const updateSection = useEditor((s) => s.updateSection);
  const removeSection = useEditor((s) => s.removeSection);

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #e6e8eb',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e6e8eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>CÁC PHẦN</strong>
        <button onClick={addSection} style={smallBtn} title="Thêm phần">
          +
        </button>
      </div>

      {doc.sections.map((section) => (
        <div key={section.id} style={{ borderBottom: '1px solid #f0f1f3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', background: '#fafbfc' }}>
            <input
              value={section.name}
              onChange={(e) => updateSection(section.id, { name: e.target.value })}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontWeight: 600 }}
            />
            <input
              type="number"
              value={Math.round(section.height)}
              onChange={(e) => updateSection(section.id, { height: Math.max(80, Number(e.target.value)) })}
              title="Chiều cao — đổi sẽ dịch mọi phần bên dưới"
              style={{ width: 56, border: '1px solid #e6e8eb', borderRadius: 4, padding: '2px 4px' }}
            />
            <button
              onClick={() => removeSection(section.id)}
              disabled={doc.sections.length === 1}
              style={{ ...smallBtn, opacity: doc.sections.length === 1 ? 0.35 : 1 }}
              title="Xoá phần (kèm mọi node trong đó)"
            >
              ×
            </button>
          </div>

          {nodesOfSection(doc, section.id).map((node) => {
            const active = selection.includes(node.id);
            return (
              <div
                key={node.id}
                onMouseEnter={() => setHover(node.id)}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => (e.shiftKey ? toggleSelect(node.id) : select([node.id]))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px 4px 14px',
                  cursor: 'pointer',
                  background: active ? '#eef3ff' : undefined,
                  color: node.props.hidden ? '#9ca3af' : undefined,
                }}
              >
                <span style={{ width: 14, textAlign: 'center', color: '#6b7280' }}>{TYPE_ICON[node.type] ?? '·'}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {labelOf(node)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateProps(node.id, { hidden: !node.props.hidden } as any);
                  }}
                  style={ghostBtn}
                  title="Ẩn/hiện"
                >
                  {node.props.hidden ? '◌' : '◉'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateProps(node.id, { locked: !node.props.locked } as any);
                  }}
                  style={ghostBtn}
                  title="Khoá/mở"
                >
                  {node.props.locked ? '🔒' : '🔓'}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

function nodesOfSection(doc: TemplateDoc, sectionId: string): TemplateNode[] {
  return doc.order
    .map((id, i) => ({ node: doc.nodes[id], i }))
    .filter((x): x is { node: TemplateNode; i: number } => Boolean(x.node) && x.node!.sectionId === sectionId)
    .sort((a, b) => b.node.props.zIndex - a.node.props.zIndex || b.i - a.i)
    .map((x) => x.node);
}

/** Text lấy luôn nội dung làm nhãn, các loại khác dùng tên mặc định */
function labelOf(node: TemplateNode): string {
  if (node.type === 'Text') {
    const plain = node.props.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return plain.slice(0, 28) || node.name;
  }
  return node.name;
}

const smallBtn = {
  width: 20,
  height: 20,
  border: '1px solid #d8dbe0',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  lineHeight: 1,
} as const;

const ghostBtn = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  fontSize: 11,
  opacity: 0.7,
} as const;
