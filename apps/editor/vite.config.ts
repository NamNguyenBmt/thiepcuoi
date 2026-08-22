import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * schema và runtime được import thẳng từ source (không build trước), nên alias
 * trỏ vào file .ts của chúng. Đổi code trong package là editor hot-reload luôn.
 */
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@thiepcuoi/schema': r('../../packages/schema/src/index.ts'),
      '@thiepcuoi/runtime': r('../../packages/runtime/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Editor 5173 → web 3000. Proxy thay vì bật CORS: khi deploy chung domain
    // thì đường dẫn /api trong code vẫn đúng nguyên.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
