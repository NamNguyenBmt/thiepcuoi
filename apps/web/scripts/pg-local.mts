/**
 * Vòng đời Postgres cục bộ (bộ binaries trong `.local/pgsql`).
 *
 *   npm run db init | start | stop | status | psql
 *
 * Viết bằng node thay vì nhét đường dẫn thẳng vào npm script: trên Windows,
 * npm chạy script qua cmd.exe và đường dẫn kiểu `../../.local/...` bị hiểu thành
 * lệnh `..`; còn viết kiểu Windows thì lại hỏng trên máy khác.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exe = (name: string) =>
  join(root, '.local', 'pgsql', 'bin', process.platform === 'win32' ? `${name}.exe` : name);

const DATA = join(root, '.local', 'pgdata');
const LOG = join(root, '.local', 'pg.log');
const PORT = process.env.PGPORT ?? '5433';

function run(bin: string, args: string[]): number {
  const result = spawnSync(bin, args, { stdio: 'inherit' });
  return result.status ?? 1;
}

/**
 * Riêng `start` phải tách hẳn stdio.
 *
 * `pg_ctl start` sinh ra tiến trình server; nếu server kế thừa stdout của ta thì
 * ống không bao giờ đóng và lệnh treo mãi (dù server đã chạy). Bỏ stdio đi thì
 * wrapper trả về ngay, còn thông tin khởi động vẫn nằm trong `.local/pg.log`.
 *
 * Lưu ý: server là con của shell gọi lệnh này. Shell nào bị giết cả cây tiến
 * trình (ví dụ lệnh bị timeout) sẽ kéo server chết theo — chạy từ terminal
 * thường thì không sao.
 */
function runDetached(bin: string, args: string[]): number {
  const result = spawnSync(bin, args, { stdio: 'ignore' });
  return result.status ?? 1;
}

const command = process.argv[2];

if (!existsSync(exe('pg_ctl'))) {
  console.error(`Không thấy Postgres ở ${join(root, '.local', 'pgsql')}.`);
  console.error('Tải bộ binaries về đó, hoặc trỏ DATABASE_URL tới một Postgres khác.');
  process.exit(1);
}

switch (command) {
  case 'init':
    process.exit(
      run(exe('initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']),
    );
  case 'start': {
    const code = runDetached(exe('pg_ctl'), ['-D', DATA, '-l', LOG, '-o', `-p ${PORT}`, 'start']);
    console.log(code === 0 ? `Postgres đang chạy ở cổng ${PORT} (log: ${LOG})` : 'Khởi động thất bại, xem log');
    process.exit(code);
  }
  case 'stop':
    process.exit(run(exe('pg_ctl'), ['-D', DATA, 'stop']));
  case 'status':
    process.exit(run(exe('pg_ctl'), ['-D', DATA, 'status']));
  case 'psql':
    process.exit(run(exe('psql'), ['-h', 'localhost', '-p', PORT, '-U', 'postgres', ...process.argv.slice(3)]));
  default:
    console.error('Dùng: npm run db -- <init|start|stop|status|psql>');
    process.exit(1);
}
