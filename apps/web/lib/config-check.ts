/**
 * Kiểm cấu hình.
 *
 * Ở production, thiếu biến môi trường phải biết ngay lúc khởi động chứ không
 * phải lúc khách mời bấm nút. Ở dev thì chỉ cảnh báo, vì mặc định (PGlite, đĩa
 * cục bộ) vẫn chạy được.
 */

export interface ConfigIssue {
  level: 'error' | 'warn';
  key: string;
  message: string;
}

export function checkConfig(env: NodeJS.ProcessEnv = process.env): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const production = env.NODE_ENV === 'production';

  const err = (key: string, message: string) => issues.push({ level: 'error', key, message });
  const warn = (key: string, message: string) => issues.push({ level: 'warn', key, message });

  if (!env.DATABASE_URL) {
    (production ? err : warn)(
      'DATABASE_URL',
      production
        ? 'Bắt buộc ở production — PGlite nhúng không dùng để chạy thật'
        : 'Chưa đặt: đang dùng PGlite nhúng (chỉ hợp dev)',
    );
  }

  // Ba biến S3 phải có đủ hoặc không có cái nào; có một nửa là cấu hình dở dang
  const s3Keys = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
  const present = s3Keys.filter((k) => env[k]);
  if (present.length > 0 && present.length < s3Keys.length) {
    err('S3_*', `Thiếu ${s3Keys.filter((k) => !env[k]).join(', ')} — cấu hình S3 dở dang`);
  }
  if (present.length === 0) {
    (production ? err : warn)(
      'S3_BUCKET',
      production
        ? 'Bắt buộc ở production — ảnh lưu trên đĩa sẽ mất sau mỗi lần deploy'
        : 'Chưa đặt: ảnh lưu vào .data/uploads',
    );
  }

  if (production && !env.NEXT_PUBLIC_ASSET_BASE && !env.S3_BUCKET) {
    warn('NEXT_PUBLIC_ASSET_BASE', 'Không đặt thì ảnh phục vụ qua chính app, không qua CDN');
  }

  if (env.SEED_PASSWORD && env.SEED_PASSWORD.length < 12) {
    warn('SEED_PASSWORD', 'Ngắn quá — nên để trống cho hệ thống tự sinh');
  }

  return issues;
}

/** In ra lúc khởi động; ném lỗi nếu production mà cấu hình sai */
export function assertConfig(): void {
  const issues = checkConfig();
  for (const i of issues) {
    console[i.level === 'error' ? 'error' : 'warn'](`[config] ${i.level}: ${i.key} — ${i.message}`);
  }
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Cấu hình thiếu: ${errors.map((e) => e.key).join(', ')}`);
  }
}
