/**
 * Sinh slug từ tên tiếng Việt.
 *
 * `normalize('NFD')` tách dấu thành ký tự tổ hợp riêng rồi xoá, nên "Quân" →
 * "quan" mà không cần bảng tra. Riêng chữ đ/Đ không phải là "d + dấu" nên
 * normalize không đụng tới, phải thay tay.
 */

export function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Slug chưa bị dùng. Trùng thì thêm hậu tố số — "quan-lan", "quan-lan-2", …
 * Người dùng thấy được slug nên hậu tố đọc được vẫn hơn uuid.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = toSlug(base) || 'thiep';

  if (!used.has(root)) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Slug do người dùng tự gõ: chấp nhận nếu sạch, còn không thì trả null */
export function validateSlug(input: string): string | null {
  const slug = toSlug(input);
  return slug.length >= 3 ? slug : null;
}
