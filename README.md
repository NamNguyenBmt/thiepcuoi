# ThiepCuoiOnline

Nền tảng thiệp cưới online: một schema, một renderer, dùng chung cho editor kéo
thả và trang thiệp công khai.

```
packages/schema    định dạng TemplateDoc + nén/validate/token          → README
packages/runtime   renderer React đọc TemplateDoc                       → README
apps/editor        editor kéo thả (Vite + zustand + immer)              → README
apps/web           trang thiệp + API RSVP/lưu bút/lưu mẫu (Next.js)     → README
```

## Chạy

```bash
docker compose up --build   # cả stack: web + Postgres + MinIO

# hoặc chạy trực tiếp:
npm run install:all
npm run dev:web      # http://localhost:3000
npm run dev:editor   # http://localhost:5173  (proxy /api sang 3000)
npm test             # schema + runtime + web
npm run typecheck    # cả 4 package
```

## Ba ý tưởng xuyên suốt

**1. Một renderer duy nhất.** `CanvasRenderer` vẽ cả trong editor lẫn trên trang
thiệp; khác biệt duy nhất là `mode` trong context. Editor không có bản render
riêng, nên thứ người thiết kế kéo chính là thứ khách mời nhìn thấy. Viết hai bản
render là nguồn sai lệch WYSIWYG kinh điển.

**2. Thiết kế tách khỏi nội dung.** `TemplateDoc` là bản vẽ dùng chung cho mọi
cặp đôi; `InviteData` là nội dung của một tấm thiệp. Text trong template chứa
token `{{groom.fullName}}`, resolve lúc render. Nhờ vậy sửa lỗi trong mẫu là mọi
thiệp dùng mẫu đó được sửa theo, và mỗi thiệp chỉ tốn ~2 KB thay vì nhân bản cả
doc 120 KB.

**3. Validate ở cả hai đầu.** `validateDoc` bắt các ràng buộc mà type system
không thấy: `order` lệch với `nodes`, section chồng nhau, font dùng mà chưa khai
báo. Editor chạy nó trước khi cho bấm Lưu, server chạy lại lần nữa trước khi ghi
— một doc hỏng lọt vào DB sẽ làm chết trang thiệp của mọi cặp đôi dùng mẫu đó.

## Vòng đời

```
chủ thiệp ──POST /api/templates──►  mẫu mới (trống hoặc nhân bản)
          ──POST /api/invites────►  thiệp nháp ──PUT──► phát hành

editor  ──PUT /api/templates/[id]──►  DB (docPacked, revision)
                                        │
                                        ▼
khách ──GET /thiep/[slug]──►  template + InviteData ──► CanvasRenderer (SSR)
                                        │
                     POST /api/invites/[id]/rsvp ◄── form xác nhận
```

## Trạng thái

Đã có: schema đầy đủ 11 loại node, renderer SSR-safe, editor kéo thả với
undo/redo và snap, trang thiệp + API RSVP/lưu bút, lưu mẫu từ editor có chống
ghi đè bằng `revision`, thư viện ảnh (upload + phục vụ kèm crop/resize/webp),
đăng nhập + phân quyền theo chủ sở hữu, tạo mẫu/thiệp và phát hành từ giao diện,
lưu trữ trên Postgres.

Tài khoản đầu tiên do seed tạo, mật khẩu ngẫu nhiên in ra log server một lần.
Đổi bằng: `npm run passwd -- <email> --prefix apps/web`.

Chưa có: đăng ký tài khoản, captcha, chuyển hướng khi đổi slug, rate limit dùng chung
nhiều instance. Dockerfile đã build và chạy thật (image 364 MB, health check xanh);
quy trình deploy ở apps/web/docs/deploy.md. Chi tiết trong phần "Còn thiếu" của README từng package.

## Lưu trữ

**Postgres.** `apps/web/lib/db.ts` giữ nguyên chữ ký các hàm như hồi còn ghi
file JSON — đúng như interface hẹp đã hứa, đổi kho lưu trữ mà API, trang thiệp
và editor không phải sửa dòng nào.

Có `DATABASE_URL` thì dùng driver `pg`; không có thì dùng **PGlite** — chính
Postgres biên dịch sang WASM — nên test không phải cài gì.

Máy này đã có sẵn PostgreSQL 17.6 dạng giải nén ở `.local/pgsql` (183 MB):

```bash
npm run db -- start --prefix apps/web    # cổng 5433
```

Cả bộ test lẫn toàn bộ luồng nghiệp vụ đã chạy qua **cả hai driver**.
Chi tiết: [apps/web/docs/database.md](apps/web/docs/database.md).
