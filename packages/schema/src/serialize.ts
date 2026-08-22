/**
 * Nén / giải nén / kiểm tra tính hợp lệ của TemplateDoc.
 *
 * Vì sao nén: doc đầy đủ prop của một thiệp ~90–150 KB JSON. Nhét thẳng vào
 * payload SSR sẽ phình HTML. Nén rồi base64 xuống còn ~20–25 KB.
 *
 * Chọn gì:
 *   - lzutf8  : nén tốt với text tiếng Việt, decode được ở cả browser lẫn node,
 *               không cần WASM. Đây là thứ cinelove.me dùng.
 *   - gzip    : nén tốt hơn ~15% nhưng phải qua CompressionStream / pako.
 * Mặc định dùng lzutf8 vì đơn giản; đổi codec chỉ cần sửa 2 hàm dưới.
 */

// lzutf8 là CJS: dưới ESM phải lấy qua default import, `import * as` cho namespace rỗng
import LZUTF8 from 'lzutf8';
import type { TemplateDoc, TemplateNode, NodeType, AssetKey, ImageTransform } from './types';
import { SCHEMA_VERSION } from './types';
import { NODE_DEFAULTS } from './defaults';

// ─────────────────────────── Codec ───────────────────────────

export function packDoc(doc: TemplateDoc): string {
  return LZUTF8.compress(JSON.stringify(doc), { outputEncoding: 'Base64' }) as string;
}

export function unpackDoc(packed: string): TemplateDoc {
  const json = LZUTF8.decompress(packed, {
    inputEncoding: 'Base64',
    outputEncoding: 'String',
  }) as string;
  return migrate(JSON.parse(json));
}

// ─────────────────────────── Migration ───────────────────────────

type Migration = (doc: any) => any;

/**
 * Mỗi lần thêm prop mới vào schema thì tăng SCHEMA_VERSION và thêm 1 entry.
 * Doc cũ trong DB không cần backfill — migrate chạy lúc load.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 1: () => ...  (v1 là bản đầu, chưa có migration nào)
};

export function migrate(doc: any): TemplateDoc {
  let v = doc.schemaVersion ?? 0;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (step) doc = step(doc);
    v += 1;
  }
  doc.schemaVersion = SCHEMA_VERSION;
  // Bù prop thiếu: doc cũ có thể không có prop mới thêm ở bản vá nhỏ
  for (const id of Object.keys(doc.nodes ?? {})) {
    const node = doc.nodes[id] as TemplateNode;
    const defaults = NODE_DEFAULTS[node.type as NodeType];
    if (defaults) node.props = { ...defaults(), ...node.props } as any;
  }
  return doc as TemplateDoc;
}

// ─────────────────────────── Validate ───────────────────────────

export interface ValidationIssue {
  level: 'error' | 'warn';
  path: string;
  message: string;
}

/**
 * Kiểm tra bất biến của doc. Chạy trước khi lưu trong editor và trong test.
 * Không thay thế zod — đây là các ràng buộc quan hệ mà type system không bắt được.
 */
export function validateDoc(doc: TemplateDoc): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warn', path, message });

  const nodeIds = Object.keys(doc.nodes);
  const sectionIds = new Set(doc.sections.map((s) => s.id));

  if (doc.canvas.baseWidth <= 0) err('canvas.baseWidth', 'phải > 0');

  // order phải phủ đúng tập node
  const orderSet = new Set(doc.order);
  if (orderSet.size !== doc.order.length) err('order', 'có id trùng');
  for (const id of doc.order) {
    if (!doc.nodes[id]) err(`order`, `id "${id}" không có node tương ứng`);
  }
  for (const id of nodeIds) {
    if (!orderSet.has(id)) err(`nodes.${id}`, 'không nằm trong order → sẽ không được vẽ');
  }

  // section
  const sorted = [...doc.sections].sort((a, b) => a.top - b.top);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.top + prev.height > cur.top + 0.5) {
      warn(`sections.${cur.id}`, `chồng lên "${prev.id}"`);
    }
  }
  const last = sorted[sorted.length - 1];
  if (last && Math.abs(last.top + last.height - doc.canvas.height) > 1) {
    warn('canvas.height', `không khớp đáy section cuối (${last.top + last.height})`);
  }

  // node
  const usedFonts = new Set<string>();
  for (const id of nodeIds) {
    const n = doc.nodes[id];
    const p: any = n.props;
    if (n.id !== id) err(`nodes.${id}.id`, `lệch với key ("${n.id}")`);
    if (!sectionIds.has(n.sectionId)) err(`nodes.${id}.sectionId`, `section "${n.sectionId}" không tồn tại`);
    if (p.width <= 0 || p.height <= 0) err(`nodes.${id}`, 'width/height phải > 0');
    if (p.opacity < 0 || p.opacity > 1) err(`nodes.${id}.opacity`, 'phải trong [0, 1]');
    if (p.left + p.width < 0 || p.left > doc.canvas.baseWidth) {
      warn(`nodes.${id}`, 'nằm ngoài canvas theo chiều ngang');
    }
    if (p.fontFamily) usedFonts.add(p.fontFamily);
    if (n.type === 'Photo' && !p.imgKey) warn(`nodes.${id}.imgKey`, 'ảnh trống');
    if (n.type === 'Text' && !String(p.text).trim()) warn(`nodes.${id}.text`, 'text rỗng');
  }

  // font phải được khai báo, nếu không runtime sẽ fallback về sans-serif
  const declared = new Set(doc.fonts.map((f) => f.family));
  for (const f of usedFonts) {
    if (!declared.has(f) && !GENERIC_FONTS.has(f)) {
      err('fonts', `font "${f}" được dùng nhưng không khai báo trong doc.fonts`);
    }
  }

  return issues;
}

const GENERIC_FONTS = new Set(['Arial', 'Roboto', 'sans-serif', 'serif', 'inherit']);

// ─────────────────────────── Asset URL ───────────────────────────

/**
 * AssetKey → URL. Query transform gắn sẵn trong key (crop) được giữ nguyên,
 * tham số hiển thị (resize/format/quality) do renderer quyết định theo DPR.
 */
export function assetUrl(base: string, key: AssetKey, t: ImageTransform = {}): string {
  if (!key) return '';
  const [path, existing] = key.split('?');
  const params = new URLSearchParams(existing ?? '');
  if (t.crop) params.set('crop', `${t.crop.x},${t.crop.y},${t.crop.w},${t.crop.h}`);
  if (t.resize) params.set('resize', `${Math.round(t.resize)}x`);
  if (t.format) params.set('format', t.format);
  if (t.quality) params.set('quality', String(t.quality));
  const qs = params.toString();
  return `${base.replace(/\/$/, '')}/${path}${qs ? `?${qs}` : ''}`;
}

// ─────────────────────────── Token binding ───────────────────────────

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Thay {{groom.fullName}} bằng dữ liệu thiệp. Token không resolve được thì
 * giữ nguyên trong editor (để designer thấy mình gõ sai) và xoá khi render thật.
 */
export function resolveTokens(
  text: string,
  data: unknown,
  mode: 'editor' | 'render' = 'render',
): string {
  return text.replace(TOKEN_RE, (whole, path: string) => {
    const value = path.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), data);
    if (value == null || value === '') return mode === 'editor' ? whole : '';
    return String(value);
  });
}

/** Liệt kê mọi token đang dùng trong doc — để build form nhập liệu động */
export function collectTokens(doc: TemplateDoc): string[] {
  const found = new Set<string>();
  for (const node of Object.values(doc.nodes)) {
    if (node.type !== 'Text') continue;
    for (const m of node.props.text.matchAll(TOKEN_RE)) found.add(m[1]);
  }
  return [...found].sort();
}
