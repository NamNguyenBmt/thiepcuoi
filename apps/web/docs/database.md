# Lưu trữ: Postgres

`lib/db.ts` giữ nguyên chữ ký các hàm như hồi còn ghi file JSON — đó là lý do
việc bọc mọi truy cập sau một interface hẹp ngay từ đầu là đáng: API, trang thiệp
và editor không phải sửa dòng nào khi đổi kho lưu trữ.

```
lib/schema.sql  DDL, chạy lại được nhiều lần
lib/sql.ts      chọn driver, chạy DDL, seed khi database trống
lib/db.ts       truy vấn — snake_case trong DB, camelCase ra ngoài
```

## Hai driver, một phương ngữ SQL

| Có `DATABASE_URL` | Driver | Dùng khi |
|---|---|---|
| có | `pg` | production, hoặc dev có Postgres thật |
| không | `@electric-sql/pglite` | test và chạy thử cục bộ |

PGlite **là** Postgres (18.3) biên dịch sang WASM, không phải bản mô phỏng, nên
SQL viết một lần chạy được cả hai nơi. Test dùng `PGLITE_DIR=memory://` để mỗi
lần chạy là một database sạch.

## Bảng

`users`, `sessions`, `assets`, `templates`, `invites`, `rsvps`, `wishes` — xem
`lib/schema.sql`. Vài lựa chọn có chủ ý:

- **`invites.template_id` KHÔNG cascade.** Xoá mẫu khi còn thiệp phải là lỗi,
  không phải xoá kèm. `deleteTemplate` đếm trước trong cùng transaction và trả
  `false`, API đổi thành 409.
- **`rsvps`/`wishes` cascade theo `invites`.** Xoá thiệp thì phản hồi của khách
  cũng đi theo, không để lại rác mồ côi.
- **`invites.data` là `jsonb`.** Nội dung thiệp là tài liệu, không phải quan hệ;
  tách thành bảng con chỉ để join lại mỗi lần render là lỗ vốn.
- **Khoá ngoại thật sự có ích:** bản JSON trước đây nhận cả lời chúc gắn với
  thiệp không tồn tại. Giờ Postgres chặn — có test cho đúng ca đó.

## Ba cái bẫy đã gặp

**1. Đóng gói.** `pg` và `@electric-sql/pglite` phải nằm trong
`config.externals` (xem `next.config.mjs`), không chỉ `serverExternalPackages`.
Webpack bundle `pg` vào là gãy ngay lúc khởi động (`Can't resolve 'fs'`,
`pg-native`), còn bundle PGlite thì bộ nhớ WASM đi qua bộ serialize của Next và
mọi trang trả 500 với `ArrayBuffer is not detachable and could not be cloned`.

**2. DDL nhiều câu lệnh.** Không gửi cả script trong một gói: prepared statement
chỉ nhận một câu (`cannot insert multiple commands into a prepared statement`),
còn server socket của PGlite thì đóng thẳng kết nối. `migrate()` tách ra chạy
từng câu.

**3. Vòng phụ thuộc khi seed.** `sql.ts` nạp `./seed` bằng **dynamic import**;
để import tĩnh thì webpack kéo `seed → auth → node:crypto` vào một layer không
hiểu scheme `node:` và build hỏng.

## Chạy cục bộ

### Postgres thật (khuyến nghị, đã kiểm)

Bộ binaries nằm ở `.local/pgsql` (PostgreSQL 17.6, cài kiểu giải nén nên không
cần quyền admin và không đăng ký service — gỡ chỉ cần xoá thư mục `.local`).
Đã bỏ `pgAdmin 4` và `StackBuilder` khỏi bộ giải nén: server không dùng tới,
mà chúng chiếm 707 trong 890 MB. Còn lại 183 MB.

Nếu cần pgAdmin thì tải lại bộ zip của EnterpriseDB, không phải cài lại server.

```bash
npm run db -- init     # tạo cluster ở .local/pgdata (chỉ lần đầu)
npm run db -- start    # nghe cổng 5433, log ở .local/pg.log
npm run db -- status
npm run db -- stop
npm run db -- psql     # mở psql
```

`start` cố tình bỏ stdio của tiến trình con: server kế thừa stdout thì ống không
bao giờ đóng và lệnh treo mãi dù server đã chạy. Thông tin khởi động vẫn ghi vào
`.local/pg.log`.

Server là tiến trình con của shell gọi lệnh. Chạy từ terminal thường thì nó sống
độc lập, nhưng nếu shell đó bị giết cả cây tiến trình (ví dụ lệnh bị timeout)
thì server chết theo — lúc đó `npm run db -- start` lại là xong.

Tạo database rồi trỏ `.env.local` vào:

```
DATABASE_URL=postgres://postgres@localhost:5433/thiepcuoi
```

Chạy chính bộ test đó trên Postgres thật:

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5433/thiepcuoi_test npm test
```

Test tự `drop schema public cascade` trước khi chạy, nên đừng trỏ vào database
có dữ liệu thật. Không đặt biến này thì test chạy PGlite trong RAM — cùng bộ
assert, khác driver.

### Không có Postgres

Bỏ trống `DATABASE_URL` là app tự dùng PGlite nhúng (ghi vào `.data/pg`). Bản
build production chạy đúng:

```bash
npm run build && npm start
```

Nhưng `npm run dev` thì **các trang truyền dữ liệu DB xuống client component trả
500** (`ArrayBuffer is not detachable`): Next dev render trong worker thread và
transfer buffer, không hợp với bộ nhớ WASM cùng tiến trình.

Đã kiểm: đổi sang Postgres thật là hết — cùng mã nguồn, cùng SQL, chỉ khác
driver. Vậy nên hạn chế này thuộc về PGlite trong dev của Next, không phải lớp
SQL.
