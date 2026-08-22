/**
 * Chạy MinIO cục bộ làm kho S3 cho dev.
 *
 *   npm run s3:dev
 *
 * MinIO nói đúng giao thức S3 như Cloudflare R2, nên nhánh code chạy được ở đây
 * thì chạy được trên R2 — khỏi cần tài khoản cloud lúc phát triển.
 *
 * Khoá truy cập lấy từ MINIO_ROOT_USER / MINIO_ROOT_PASSWORD, mặc định trùng với
 * `.env.local` mẫu để chạy phát là xong.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const bin = join(root, '.local', process.platform === 'win32' ? 'minio.exe' : 'minio');
const dataDir = process.env.MINIO_DIR ?? join(root, '.local', 'minio-data');
const port = process.env.MINIO_PORT ?? '9000';

if (!existsSync(bin)) {
  console.error(`Không thấy MinIO ở ${bin}.`);
  console.error('Tải về: https://dl.min.io/server/minio/release/windows-amd64/minio.exe');
  console.error('Hoặc bỏ trống S3_BUCKET để dùng đĩa cục bộ.');
  process.exit(1);
}

const child = spawn(
  bin,
  ['server', dataDir, '--address', `127.0.0.1:${port}`, '--console-address', '127.0.0.1:9001'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      MINIO_ROOT_USER: process.env.MINIO_ROOT_USER ?? 'thiepcuoi',
      MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD ?? 'thiepcuoi-local',
    },
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
