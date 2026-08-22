/**
 * Nạp `.env.local` cho các script chạy ngoài Next.
 *
 * Next tự đọc file này, nhưng `tsx scripts/...` thì không — hệ quả là script cứ
 * báo "chưa cấu hình" dù `.env.local` đã có đủ. Không kéo thêm dotenv vì định
 * dạng ở đây chỉ có `KEY=value` và dòng chú thích.
 *
 * Biến đã có sẵn trong môi trường được ưu tiên, để còn ghi đè khi chạy một lần:
 *   S3_BUCKET=khac npm run assets:migrate
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnvLocal(file = '.env.local'): void {
  let content: string;
  try {
    content = readFileSync(join(process.cwd(), file), 'utf8');
  } catch {
    return; // không có file thì thôi, không phải lỗi
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq < 0) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
