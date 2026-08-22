# Build từ gốc repo, không phải từ apps/web:
#   docker build -t thiepcuoi .
#
# apps/web phụ thuộc packages/schema và packages/runtime qua "file:../../..",
# nên context phải chứa cả ba.
#
# Quan trọng: build DIỄN RA BÊN TRONG image, không chép bản đã build sẵn từ máy
# phát triển vào. sharp, pg và pglite đều mang phần binary theo nền tảng — bản
# dựng trên Windows hay macOS đưa vào image Linux là hỏng lúc chạy.

# ─────────────────────────── nền chung ───────────────────────────
FROM node:22-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ─────────────────────────── cài phụ thuộc ───────────────────────────
FROM base AS deps

# Chép trước phần khai báo để tầng cache còn dùng lại được khi chỉ sửa mã nguồn
COPY packages/schema/package.json ./packages/schema/
COPY packages/runtime/package.json ./packages/runtime/
COPY apps/web/package.json ./apps/web/

# Hai package nội bộ được nối bằng "file:", npm cần thấy source thật lúc cài
COPY packages/schema ./packages/schema
COPY packages/runtime ./packages/runtime

# Mỗi package nội bộ có phụ thuộc riêng (schema cần lzutf8). Chỉ cài trong
# apps/web là không đủ: khi webpack biên dịch packages/schema/src/*, nó tìm
# node_modules từ thư mục của chính package đó đi lên, không ngó sang apps/web.
# Cài kèm cả devDependencies, không dùng --omit=dev: `next build` kiểm kiểu cả
# source của hai package này, mà `@types/react` lại nằm ở devDependencies của
# chúng. Thiếu là build chết với "Could not find a declaration file for module
# 'react'". Tầng runner chỉ chép bản standalone nên image cuối không mang theo.
WORKDIR /app/packages/schema
RUN npm install --no-audit --no-fund

WORKDIR /app/packages/runtime
RUN npm install --no-audit --no-fund

WORKDIR /app/apps/web
RUN npm install --no-audit --no-fund

# ─────────────────────────── build ───────────────────────────
FROM base AS builder

COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web

WORKDIR /app/apps/web
# Gộp một RUN: Next không tự chép static vào bản standalone, thiếu là trang có
# HTML mà mất sạch CSS/JS
RUN npm run build \
 && cp -r .next/static .next/standalone/apps/web/.next/static

# ─────────────────────────── chạy ───────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Không chạy bằng root. node:22-slim có sẵn user "node" = uid 1000; ghi bằng số
# để `runAsNonRoot` của Kubernetes kiểm chứng được mà không phải đọc /etc/passwd.
USER 1000:1000

# Bản standalone giữ nguyên cấu trúc monorepo: server.js nằm ở apps/web/,
# packages/ nằm cạnh — nhờ `outputFileTracingRoot` trỏ về gốc repo.
# (Dự án chưa có thư mục public nào; có thì thêm một dòng COPY nữa.)
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./

WORKDIR /app/apps/web

EXPOSE 3000

# /api/health chạm thật vào database và kho ảnh, nên nó là health check có nghĩa
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
