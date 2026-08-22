import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

/**
 * schema và runtime là source TypeScript chưa build, nên phải cho Next biên dịch
 * chúng như code trong app (transpilePackages) và trỏ alias thẳng vào src.
 * Đổi code trong package là web hot-reload luôn, không cần bước build trung gian.
 *
 * @type {import('next').NextConfig}
 */
export default {
  reactStrictMode: true,
  // Bản chạy độc lập: chỉ cần thư mục .next/standalone + node, không cần
  // node_modules đầy đủ — ảnh Docker nhẹ đi rất nhiều.
  output: 'standalone',
  /**
   * `lib/schema.sql` được đọc bằng fs lúc chạy, mà Next chỉ trace file JS —
   * không khai ở đây thì bản standalone thiếu nó và app chết ngay khi migrate.
   */
  outputFileTracingIncludes: { '/**': ['./lib/schema.sql'] },
  /**
   * Cố định gốc trace về gốc repo. Không đặt thì Next tự đoán, và cấu trúc thư
   * mục standalone khác nhau giữa máy dev với image Docker — đường dẫn trong
   * Dockerfile sẽ trỏ trượt.
   */
  outputFileTracingRoot: r('../../'),
  // Native + WASM: để Next bundle vào là hỏng (sharp có .node, pglite có .wasm)
  serverExternalPackages: ['sharp', 'pg', '@electric-sql/pglite'],
  /**
   * Editor là bản Vite build sẵn nằm trong `public/editor/`. File tĩnh không có
   * "index của thư mục", nên `/editor` trần sẽ 404 — mà đó lại đúng là đường
   * dẫn các nút "mở trong editor" trỏ tới.
   */
  async rewrites() {
    return [{ source: '/editor', destination: '/editor/index.html' }];
  },
  transpilePackages: ['@thiepcuoi/schema', '@thiepcuoi/runtime'],
  webpack: (config, { isServer }) => {
    config.resolve.alias['@thiepcuoi/schema'] = r('../../packages/schema/src/index.ts');
    config.resolve.alias['@thiepcuoi/runtime'] = r('../../packages/runtime/src/index.ts');

    if (isServer) {
      // serverExternalPackages không với tới layer biên dịch instrumentation.ts,
      // nên phải khai externals tay: `pg` kéo theo `fs`/`pg-native` và webpack
      // bundle vào là gãy ngay lúc server khởi động.
      config.externals = [...(config.externals ?? []), 'pg', 'pg-native', '@electric-sql/pglite'];
    }
    return config;
  },
};
