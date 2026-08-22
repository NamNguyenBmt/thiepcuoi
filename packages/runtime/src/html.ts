/**
 * TextProps.text là HTML inline (người dùng bôi đậm / đổi màu một cụm chữ),
 * nên bắt buộc phải lọc trước khi đưa vào dangerouslySetInnerHTML.
 *
 * Đây là allowlist cố ý hẹp: chỉ đủ cho những gì thanh công cụ text cho phép.
 * Muốn thêm thẻ thì sửa ở đây, đừng nới lỏng ở chỗ gọi.
 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'br', 'span', 'div', 'p']);
const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color', 'font-weight', 'font-style', 'font-size',
  'text-decoration', 'letter-spacing', 'line-height',
]);

/** url(...) và expression(...) trong style là đường vào cho nội dung ngoài */
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|javascript:/i;

function sanitizeStyle(raw: string): string {
  return raw
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .filter((decl) => {
      const idx = decl.indexOf(':');
      if (idx < 0) return false;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1);
      return ALLOWED_STYLE_PROPS.has(prop) && !UNSAFE_STYLE_VALUE.test(value);
    })
    .join('; ');
}

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const STYLE_ATTR_RE = /style\s*=\s*("([^"]*)"|'([^']*)')/i;

/**
 * Bỏ mọi thẻ ngoài allowlist (giữ lại phần text bên trong), bỏ mọi thuộc tính
 * trừ `style` đã lọc. Không dùng DOMParser để chạy được cả trên server.
 */
export function sanitizeInlineHtml(html: string): string {
  return html.replace(TAG_RE, (_whole, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (_whole.startsWith('</')) return `</${tag}>`;
    if (tag === 'br') return '<br>';

    const m = STYLE_ATTR_RE.exec(attrs);
    const style = m ? sanitizeStyle(m[2] ?? m[3] ?? '') : '';
    return style ? `<${tag} style="${style}">` : `<${tag}>`;
  });
}

/** Text thuần để dùng cho aria-label, alt, và đo chiều cao trong editor */
export function stripHtml(html: string): string {
  return html.replace(TAG_RE, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
