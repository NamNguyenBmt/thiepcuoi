/**
 * Inspector.
 *
 * Phần chung (vị trí, kích thước, hiệu ứng) dựng từ BaseProps nên mọi node đều
 * có. Phần riêng khai báo theo NodeType trong TYPE_FIELDS — thêm loại node mới
 * chỉ cần thêm một entry, không phải viết panel mới.
 */

import type { NodeType, TemplateNode } from '@thiepcuoi/schema';
import { useEditor } from '../store';
import { CheckField, ColorField, ImageField, NumberField, S, SelectField, SliderField, TextField } from './fields';
import { pickAsset, thumbUrl } from '../assets';

type Field =
  | { kind: 'number'; key: string; label: string; step?: number }
  | { kind: 'image'; key: string; label: string }
  | { kind: 'text'; key: string; label: string }
  | { kind: 'color'; key: string; label: string }
  | { kind: 'check'; key: string; label: string }
  | { kind: 'select'; key: string; label: string; options: Array<[string, string]> };

const TYPE_FIELDS: Partial<Record<NodeType, Field[]>> = {
  Text: [
    { kind: 'text', key: 'text', label: 'Nội dung' },
    { kind: 'text', key: 'fontFamily', label: 'Font' },
    { kind: 'number', key: 'fontSize', label: 'Cỡ chữ' },
    { kind: 'color', key: 'color', label: 'Màu chữ' },
    {
      kind: 'select', key: 'fontWeight', label: 'Đậm',
      options: [['300', 'Mảnh'], ['400', 'Thường'], ['500', 'Vừa'], ['600', 'Đậm'], ['700', 'Rất đậm']],
    },
    {
      kind: 'select', key: 'textAlign', label: 'Canh lề',
      options: [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải'], ['justify', 'Đều']],
    },
    {
      kind: 'select', key: 'textTransform', label: 'Kiểu chữ',
      options: [['none', 'Giữ nguyên'], ['uppercase', 'IN HOA'], ['lowercase', 'thường'], ['capitalize', 'Hoa Đầu']],
    },
    { kind: 'text', key: 'letterSpacing', label: 'Giãn chữ' },
    { kind: 'text', key: 'lineHeight', label: 'Giãn dòng' },
  ],
  Photo: [
    { kind: 'image', key: 'imgKey', label: 'Ảnh' },
    { kind: 'text', key: 'slot', label: 'Slot' },
    { kind: 'image', key: 'maskShapeImg', label: 'Mask' },
    { kind: 'number', key: 'blur', label: 'Làm mờ (px)' },
    { kind: 'select', key: 'objectFit', label: 'Lấp khung', options: [['cover', 'Cover'], ['contain', 'Contain']] },
    { kind: 'check', key: 'isReplaceable', label: 'Cho thay ảnh' },
    { kind: 'check', key: 'flipX', label: 'Lật ngang' },
    { kind: 'check', key: 'flipY', label: 'Lật dọc' },
  ],
  Shape: [
    {
      kind: 'select', key: 'shapeKind', label: 'Loại',
      options: [['rect', 'Khối màu'], ['svg', 'SVG'], ['img', 'Ảnh']],
    },
    { kind: 'image', key: 'imgKey', label: 'File' },
    { kind: 'color', key: 'color', label: 'Màu' },
  ],
  Envelope: [
    { kind: 'image', key: 'imgKey', label: 'Ảnh lá thư' },
    { kind: 'text', key: 'slot', label: 'Slot' },
    { kind: 'image', key: 'sealImg', label: 'Dấu xi' },
    { kind: 'color', key: 'envelopeColor', label: 'Màu bì' },
    { kind: 'color', key: 'flapColor', label: 'Màu nắp' },
    { kind: 'color', key: 'pocketSideColor', label: 'Màu cánh bên' },
    { kind: 'color', key: 'pocketBottomColor', label: 'Màu cánh đáy' },
    { kind: 'color', key: 'heartColor', label: 'Màu tim' },
    { kind: 'check', key: 'lockScrollUntilOpened', label: 'Khoá cuộn tới khi mở' },
    { kind: 'number', key: 'dismissAfter', label: 'Giây rồi ẩn', step: 0.1 },
  ],
  Calendar: [
    { kind: 'text', key: 'month', label: 'Tháng (ISO)' },
    { kind: 'color', key: 'themeColor', label: 'Màu nhấn' },
    { kind: 'text', key: 'fontFamily', label: 'Font' },
    { kind: 'number', key: 'fontSize', label: 'Cỡ chữ' },
    { kind: 'image', key: 'markerIcon', label: 'Icon đánh dấu' },
    { kind: 'check', key: 'showLunar', label: 'Hiện âm lịch' },
  ],
  CountDown: [
    { kind: 'text', key: 'targetDate', label: 'Mốc (ISO)' },
    { kind: 'color', key: 'themeColor', label: 'Màu nền ô' },
    { kind: 'color', key: 'color', label: 'Màu chữ' },
    { kind: 'number', key: 'fontSize', label: 'Cỡ chữ' },
    { kind: 'number', key: 'spacing', label: 'Khoảng cách' },
    { kind: 'select', key: 'direction', label: 'Hướng', options: [['horizontal', 'Ngang'], ['vertical', 'Dọc']] },
    { kind: 'text', key: 'expiredText', label: 'Khi đã qua' },
  ],
  RsvpForm: [
    { kind: 'text', key: 'titleText', label: 'Tiêu đề' },
    { kind: 'color', key: 'buttonColor', label: 'Màu nút' },
    { kind: 'text', key: 'submitText', label: 'Chữ trên nút' },
    { kind: 'check', key: 'enableAttendeeCount', label: 'Hỏi số người' },
    { kind: 'check', key: 'enableGuestSide', label: 'Hỏi khách của ai' },
    { kind: 'check', key: 'enableTransportation', label: 'Hỏi xe đưa đón' },
    { kind: 'check', key: 'enableMessage', label: 'Ô lời chúc' },
  ],
  Gallery: [
    {
      kind: 'select', key: 'layout', label: 'Bố cục',
      options: [['carousel', 'Trượt'], ['grid', 'Lưới'], ['masonry', 'So le']],
    },
    { kind: 'check', key: 'showThumbnails', label: 'Ảnh nhỏ' },
    { kind: 'check', key: 'showNavButtons', label: 'Nút chuyển' },
    { kind: 'check', key: 'autoplay', label: 'Tự chạy' },
  ],
  GiftQr: [
    { kind: 'image', key: 'imgKey', label: 'Icon' },
    { kind: 'text', key: 'modalTitle', label: 'Tiêu đề modal' },
  ],
  Map: [
    { kind: 'text', key: 'label', label: 'Nhãn' },
    { kind: 'text', key: 'query', label: 'Địa chỉ' },
    { kind: 'select', key: 'mode', label: 'Kiểu', options: [['button', 'Nút'], ['embed', 'Nhúng bản đồ']] },
    { kind: 'color', key: 'buttonColor', label: 'Màu nút' },
  ],
  Wishes: [
    { kind: 'text', key: 'titleText', label: 'Tiêu đề' },
    { kind: 'number', key: 'maxVisible', label: 'Số lời chúc' },
  ],
  Video: [
    { kind: 'check', key: 'autoplay', label: 'Tự phát' },
    { kind: 'check', key: 'loop', label: 'Lặp' },
    { kind: 'check', key: 'muted', label: 'Tắt tiếng' },
  ],
};

const EFFECTS: Array<[string, string]> = [
  ['none', 'Không'], ['fade', 'Mờ dần'], ['slide-up', 'Trượt lên'], ['slide-down', 'Trượt xuống'],
  ['slide-left', 'Trượt trái'], ['slide-right', 'Trượt phải'], ['zoom-in', 'Phóng vào'],
  ['zoom-out', 'Thu nhỏ'], ['flip', 'Lật'], ['blur-in', 'Nét dần'],
];

const CONTINUOUS: Array<[string, string]> = [
  ['none', 'Không'], ['wobble', 'Lắc lư'], ['pulse', 'Nhịp'], ['float', 'Trôi nổi'],
  ['shake', 'Rung'], ['spin', 'Xoay'], ['heartbeat', 'Nhịp tim'],
];

export function InspectorPanel() {
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.history.present);
  const updateProps = useEditor((s) => s.updateProps);
  const reorder = useEditor((s) => s.reorder);

  const node = selection.length === 1 ? doc.nodes[selection[0]!] : undefined;

  if (!node) {
    return (
      <aside style={panelStyle}>
        <div style={{ padding: 16, color: '#6b7280' }}>
          {selection.length > 1 ? `Đang chọn ${selection.length} phần tử` : 'Chọn một phần tử để chỉnh'}
        </div>
      </aside>
    );
  }

  const p = node.props as any;
  const set = (patch: Record<string, unknown>, coalesceKey?: string) =>
    updateProps(node.id, patch as any, { coalesceKey: coalesceKey ? `${coalesceKey}:${node.id}` : undefined });

  return (
    <aside style={panelStyle}>
      <div style={{ ...S.group, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>{node.name}</strong>
        <span style={{ color: '#9ca3af', fontSize: 11 }}>{node.type}</span>
      </div>

      <div style={S.group}>
        <div style={S.groupTitle}>VỊ TRÍ &amp; KÍCH THƯỚC</div>
        <NumberField label="X" value={p.left} onChange={(v) => set({ left: v }, 'left')} />
        <NumberField label="Y" value={p.top} onChange={(v) => set({ top: v }, 'top')} />
        <NumberField label="Rộng" value={p.width} onChange={(v) => set({ width: Math.max(8, v) }, 'width')} />
        <NumberField label="Cao" value={p.height} onChange={(v) => set({ height: Math.max(8, v) }, 'height')} />
        <NumberField label="Xoay" value={p.rotation} onChange={(v) => set({ rotation: v }, 'rotation')} />
        <SliderField label="Độ mờ" value={p.opacity} onChange={(v) => set({ opacity: v }, 'opacity')} />
        <NumberField label="Lớp (z)" value={p.zIndex} onChange={(v) => set({ zIndex: v }, 'z')} />
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {(['back', 'backward', 'forward', 'front'] as const).map((d) => (
            <button key={d} onClick={() => reorder(node.id, d)} style={miniButton}>
              {{ back: '⤓', backward: '↓', forward: '↑', front: '⤒' }[d]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <CheckField label="Khoá" value={p.locked} onChange={(v) => set({ locked: v })} />
          <CheckField label="Ẩn" value={p.hidden} onChange={(v) => set({ hidden: v })} />
        </div>
      </div>

      <div style={S.group}>
        <div style={S.groupTitle}>RIÊNG CỦA {node.type.toUpperCase()}</div>
        {(TYPE_FIELDS[node.type] ?? []).map((f) => (
          <FieldView key={f.key} field={f} value={p[f.key]} onChange={(v) => set({ [f.key]: v }, f.key)} />
        ))}
      </div>

      {node.type === 'Gallery' && (
        <div style={S.group}>
          <div style={S.groupTitle}>ẢNH TRONG ALBUM ({p.photos.length})</div>
          <GalleryPhotos
            photos={p.photos}
            onChange={(photos) => set({ photos })}
          />
        </div>
      )}

      <div style={S.group}>
        <div style={S.groupTitle}>KHUNG</div>
        <ColorField label="Nền" value={p.backgroundColor} onChange={(v) => set({ backgroundColor: v }, 'bg')} />
        <NumberField label="Bo góc" value={p.borderRadius[0]} onChange={(v) => set({ borderRadius: [v, v, v, v] }, 'radius')} />
        <NumberField label="Viền" value={p.borderSize} onChange={(v) => set({ borderSize: v }, 'border')} />
        <ColorField label="Màu viền" value={p.borderColor} onChange={(v) => set({ borderColor: v }, 'borderColor')} />
        <CheckField label="Đổ bóng" value={p.hasShadow} onChange={(v) => set({ hasShadow: v })} />
      </div>

      <div style={S.group}>
        <div style={S.groupTitle}>CHUYỂN ĐỘNG</div>
        <SelectField
          label="Hiệu ứng vào"
          value={p.transition.effectType}
          options={EFFECTS}
          onChange={(v) => set({ transition: { ...p.transition, effectType: v, effectEnabled: v !== 'none' } })}
        />
        <NumberField
          label="Thời lượng"
          step={0.1}
          value={p.transition.effectDuration}
          onChange={(v) => set({ transition: { ...p.transition, effectDuration: v } }, 'dur')}
        />
        <NumberField
          label="Trễ"
          step={0.1}
          value={p.transition.effectDelay}
          onChange={(v) => set({ transition: { ...p.transition, effectDelay: v } }, 'delay')}
        />
        <SelectField
          label="Lặp"
          value={p.continuousAnimation.type}
          options={CONTINUOUS}
          onChange={(v) => set({ continuousAnimation: { ...p.continuousAnimation, type: v } })}
        />
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          Chuyển động chỉ chạy ở trang thiệp, editor luôn hiện trạng thái cuối.
        </div>
      </div>

      <div style={S.group}>
        <div style={S.groupTitle}>LIÊN KẾT</div>
        <TextField label="Hyperlink" value={p.hyperlink} onChange={(v) => set({ hyperlink: v }, 'link')} />
      </div>
    </aside>
  );
}

interface GalleryPhoto {
  id: string;
  imageKey: string;
  alt: string;
}

/** Album cần chọn nhiều ảnh một lúc, nên không dùng chung ImageField được */
function GalleryPhotos({
  photos,
  onChange,
}: {
  photos: GalleryPhoto[];
  onChange: (photos: GalleryPhoto[]) => void;
}) {
  async function add() {
    const keys = await pickAsset({ multiple: true });
    if (!keys?.length) return;
    onChange([
      ...photos,
      ...keys.map((imageKey, i) => ({
        id: `${Date.now()}-${i}`,
        imageKey,
        alt: `Ảnh ${photos.length + i + 1}`,
      })),
    ]);
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 6 }}>
        {photos.map((photo, i) => (
          <div key={photo.id} style={{ position: 'relative' }}>
            <img
              src={thumbUrl(photo.imageKey, 120)}
              alt={photo.alt}
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 4, background: '#f1f5f9' }}
            />
            <button
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              title="Bỏ ảnh này"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 16,
                height: 16,
                lineHeight: '14px',
                padding: 0,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} style={{ ...miniButton, width: '100%', padding: '5px 0' }}>
        + Thêm ảnh
      </button>
    </>
  );
}

function FieldView({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.kind) {
    case 'number':
      return <NumberField label={field.label} step={field.step} value={Number(value) || 0} onChange={onChange} />;
    case 'image':
      return <ImageField label={field.label} value={String(value ?? '')} onChange={onChange} />;
    case 'color':
      return <ColorField label={field.label} value={String(value ?? '')} onChange={onChange} />;
    case 'check':
      return <CheckField label={field.label} value={Boolean(value)} onChange={onChange} />;
    case 'select':
      return (
        <SelectField
          label={field.label}
          value={String(value ?? '')}
          options={field.options}
          onChange={onChange}
        />
      );
    default:
      return <TextField label={field.label} value={String(value ?? '')} onChange={onChange} />;
  }
}

const panelStyle = {
  width: 268,
  flexShrink: 0,
  background: '#fff',
  borderLeft: '1px solid #e6e8eb',
  overflowY: 'auto',
} as const;

const miniButton = {
  flex: 1,
  padding: '3px 0',
  border: '1px solid #d8dbe0',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
} as const;

export type { TemplateNode };
