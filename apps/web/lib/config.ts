/**
 * Base URL của ảnh. Mặc định trỏ vào chính API assets của app (đường dẫn tương
 * đối nên chạy đúng ở mọi domain, và editor gọi qua proxy cũng tới đúng chỗ).
 * Khi có CDN thật thì đặt NEXT_PUBLIC_ASSET_BASE=https://cdn... — AssetKey
 * trong TemplateDoc không phải đổi.
 */
export const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? '/api/assets';

/**
 * Editor chạy ở app riêng. Dev là cổng 5173; deploy chung domain thì đặt
 * NEXT_PUBLIC_EDITOR_URL=/editor hoặc URL đầy đủ.
 */
export const EDITOR_URL = process.env.NEXT_PUBLIC_EDITOR_URL ?? 'http://localhost:5173';
