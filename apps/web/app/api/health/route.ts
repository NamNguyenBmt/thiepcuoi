import { NextResponse } from 'next/server';
import { describeDatabaseUrl, getSql } from '@/lib/sql';
import { getBlobStore } from '@/lib/blobstore';
import { checkConfig } from '@/lib/config-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check cho hosting và cho người trực.
 *
 * Kiểm thật chứ không trả 200 suông: chạm database và chạm kho ảnh. Một health
 * check chỉ nói "tôi còn sống" là vô dụng — app vẫn trả lời được trong khi DB
 * đã chết, và lúc đó khách mời mới là người phát hiện ra.
 *
 * 200 = phục vụ được, 503 = có thành phần hỏng.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string; ms: number }> = {};

  checks.database = await timed(async () => {
    const sql = await getSql();
    const { rows } = await sql.query<{ n: string }>('select count(*)::text as n from templates');
    return `${rows[0]?.n ?? '?'} mẫu`;
  });

  // Hỏng thì nói luôn đang gõ cửa nhà nào (host/cổng, không kèm user lẫn mật
  // khẩu): "ENOTFOUND base" một mình không cho biết chuỗi kết nối sai chỗ nào.
  if (!checks.database.ok) {
    checks.database.detail += ` — đang nối tới ${describeDatabaseUrl()}`;
  }

  checks.assets = await timed(async () => {
    const store = await getBlobStore();
    // Đọc một key chắc chắn không tồn tại: lỗi "không tìm thấy" chứng minh kho
    // trả lời được, mà không cần ghi rác vào kho thật.
    try {
      await store.get(`uploads/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}.png`);
    } catch {
      /* đúng như mong đợi */
    }
    return store.describe();
  });

  const config = checkConfig().filter((i) => i.level === 'error');
  const ok = Object.values(checks).every((c) => c.ok) && config.length === 0;

  return NextResponse.json(
    {
      ok,
      checks,
      config: config.map((c) => `${c.key}: ${c.message}`),
      version: process.env.npm_package_version ?? 'dev',
    },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}

async function timed(fn: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await fn();
    return { ok: true, detail, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err), ms: Date.now() - started };
  }
}
