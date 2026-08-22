import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * schema và runtime được import thẳng từ source (không build trước), nên alias
 * trỏ vào file .ts của chúng. Đổi code trong package là editor hot-reload luôn.
 */
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [react()],
  /**
   * Bản build đi thẳng vào `public/` của web và được phục vụ ở `/editor` —
   * **cùng origin với API**. Đó là điều kiện bắt buộc chứ không phải tiện tay:
   * editor gọi `/api` bằng đường dẫn tương đối và dựa vào cookie phiên, nên
   * deploy nó sang domain khác là vừa gọi trượt API vừa mất luôn đăng nhập.
   *
   * `base` chỉ đổi lúc build; `npm run dev` vẫn chạy ở gốc cổng 5173 như cũ.
   */
  base: command === 'build' ? '/editor/' : '/',
  build: {
    outDir: r('../web/public/editor'),
    // outDir nằm ngoài thư mục gốc của editor nên Vite bắt khai báo tường minh
    emptyOutDir: true,
  },
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
}));
