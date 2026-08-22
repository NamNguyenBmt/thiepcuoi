/**
 * Đổi mật khẩu một tài khoản.
 *
 *   npm run passwd -- <email> [mật khẩu mới]
 *
 * Bỏ trống mật khẩu thì script tự sinh một chuỗi ngẫu nhiên mạnh và in ra —
 * cách này tốt hơn là gõ mật khẩu vào dòng lệnh, vì dòng lệnh còn nằm lại trong
 * lịch sử shell.
 */

import { randomBytes } from 'node:crypto';
import { loadEnvLocal } from './env.mts';

loadEnvLocal();

import { getSql } from '../lib/sql';
import { hashPassword } from '../lib/auth';

const [email, given] = process.argv.slice(2);

if (!email) {
  console.error('Dùng: npm run passwd -- <email> [mật khẩu mới]');
  process.exit(1);
}

const password = given ?? randomBytes(12).toString('base64url');

const sql = await getSql();
const { rows } = await sql.query<{ id: string }>(
  'update users set password_hash = $2 where email = $1 returning id',
  [email.trim().toLowerCase(), await hashPassword(password)],
);

if (rows.length === 0) {
  console.error(`Không có tài khoản nào với email ${email}`);
  process.exit(1);
}

console.log(`Đã đổi mật khẩu cho ${email}`);
if (!given) console.log(`Mật khẩu mới: ${password}`);
console.log('Phiên đang đăng nhập vẫn còn hiệu lực — muốn buộc đăng nhập lại thì xoá bảng sessions.');
process.exit(0);
