# @thiepcuoi/web

Trang thiệp công khai (Next.js App Router). Dùng **đúng** `CanvasRenderer` mà
editor dùng — khác biệt duy nhất là dữ liệu truyền vào.

```bash
npm install
npm run dev      # http://localhost:3000 — xem lưu ý ở docs/database.md
npm run build && npm start   # bản production, chạy đúng với PGlite nhúng
npm test         # test lớp dữ liệu, chạy trên DB tạm
npm run build
```

## Route

| Route | Việc |
|---|---|
| `/` | Danh sách thiệp đã phát hành + mẫu |
| `/dang-nhap` | Đăng nhập |
| `/dang-ky` | Đăng ký tài khoản mới (role `user`) |
| `/quan-ly` | Trang chủ thiệp: tạo mẫu/thiệp, thống kê, danh sách khách |
| `/quan-ly/thiep/[id]` | Form điền nội dung thiệp + phát hành |
| `/thiep/[slug]` | Thiệp thật: template + `InviteData` của cặp đôi |
| `/mau/[slug]` | Xem thử mẫu với dữ liệu minh hoạ, không ghi database |
| `POST /api/invites/[id]/rsvp` | Nhận xác nhận tham dự |
| `GET /api/invites/[id]/rsvp` | Thống kê + danh sách khách |
| `GET/POST /api/invites/[id]/wishes` | Sổ lưu bút |
| `GET /api/templates` | Danh sách mẫu (không kèm `docPacked`) |
| `GET /api/templates/[id]` | Một mẫu, kèm `docPacked` + `revision` |
| `PUT /api/templates/[id]` | Editor lưu mẫu |
| `GET/POST /api/assets` | Thư viện ảnh: liệt kê / tải lên |
| `GET /api/captcha` | Câu hỏi "không phải robot" cho form đăng ký |
| `GET /api/assets/[...key]` | Phục vụ ảnh kèm crop/resize/format/quality |
| `GET /api/health` | Chạm thật vào database + kho ảnh + bộ đếm rate limit; 200/503 |
| `POST /api/auth/login` · `logout` · `GET me` | Phiên đăng nhập |
| `POST /api/auth/register` | Tạo tài khoản mới, tự đăng nhập luôn sau khi tạo |
| `POST /api/templates` · `DELETE /api/templates/[id]` | Tạo mẫu (trống hoặc nhân bản) · xoá |
| `GET/POST /api/invites` · `GET/PUT /api/invites/[id]` | Tạo và sửa thiệp |

## Lưu mẫu từ editor

`PUT /api/templates/[id]` **giải nén và validate lại** doc mà editor gửi lên.
Client đã validate không có nghĩa là body đến đây hợp lệ, mà một doc hỏng lưu
được vào DB sẽ làm chết trang thiệp của **mọi** cặp đôi đang dùng mẫu đó.

| Tình huống | Mã |
|---|---|
| Thiếu `docPacked`, hoặc giải nén không ra JSON | 400 |
| `revision` gửi lên không khớp — tab khác đã lưu trong lúc đó | 409 |
| Doc giải nén được nhưng `validateDoc` báo lỗi | 422, kèm danh sách `issues` |
| Không có mẫu với id đó | 404 |

`revision` tăng sau mỗi lần lưu. Editor gửi lại số nó đọc lúc mở mẫu, nên hai
tab cùng sửa thì tab lưu sau bị chặn thay vì âm thầm đè lên tab kia.

## Tạo mẫu và thiệp

**Mẫu mới** hoặc là canvas trống, hoặc nhân bản một mẫu có sẵn (`fromTemplateId`)
— nhân bản mới là cách người ta thực sự làm mẫu mới. Bản sao được đổi `id`,
`slug`, `name` ngay trong `TemplateDoc`, nếu không nó vẫn mang danh tính của bản
gốc. Mẫu là thư viện công khai nên ai cũng nhân bản được; bản sao thuộc về người
bấm nút.

**Thiệp mới** luôn ở trạng thái nháp (`publishedAt: null`) — không ai muốn link
lộ ra ngoài khi tên còn chưa điền xong. Mở link thiệp nháp trả 404 y như thiệp
không tồn tại.

**Slug** sinh từ tên tiếng Việt bằng `normalize('NFD')` (tách dấu rồi xoá), riêng
đ/Đ phải thay tay vì nó không phải "d + dấu". Trùng thì thêm hậu tố số đọc được
(`tuan-mai-2`) chứ không dùng uuid, vì người dùng nhìn thấy slug.

Vài chốt cố ý:

- **Không xoá được mẫu còn thiệp đang dùng** (409). Xoá được thì trang thiệp của
  họ chết ngay mà chủ mẫu không hề biết mình vừa làm gì.
- **Đổi slug thiệp là đổi link đã gửi cho khách.** Slug cũ được giữ lại trong
  `invite_slug_redirects` (bảng riêng, ghi trong cùng transaction lúc đổi —
  đổi xong mà ghi redirect thất bại thì link cũ chết mà không ai biết) và
  `/thiep/[slug]` chuyển hướng vĩnh viễn (308) tới slug hiện tại khi tra trực
  tiếp không thấy. Đổi qua lại nhiều lần vẫn đúng: `on conflict` ghi đè chủ mới
  nhất cho cùng slug cũ. Tra trực tiếp luôn ưu tiên trước — thiệp khác chiếm lại
  được một slug đã bỏ, không bị bảng redirect chặn.
- **Slot ảnh trong form lấy từ chính mẫu.** Người điền thiệp chỉ thấy đúng những
  khung ảnh mà người thiết kế đã chừa, không phải đoán tên slot.
- **`InviteData` được làm sạch ở server** (`lib/invite.ts`): cắt độ dài, giới hạn
  số sự kiện/tài khoản, bỏ ngày giờ không đọc được, bỏ trường lạ.

## Xác thực

Mật khẩu băm bằng **scrypt** của `node:crypto` (không phụ thuộc native, vốn được
thiết kế đúng cho việc này), so sánh bằng `timingSafeEqual`. Phiên nằm trong
cookie `tc_session`: `HttpOnly` (XSS không đọc được), `SameSite=Lax`, `Secure`
khi production. DB chỉ lưu **sha256 của token**, không lưu token — DB rò rỉ thì
vẫn không ai đăng nhập được.

Ai xem được gì:

| Route | Ai |
|---|---|
| `/thiep/[slug]`, `/mau/[slug]`, `GET /api/assets/[...key]` | Công khai — khách mời không có tài khoản |
| `POST /api/invites/[id]/rsvp`, `POST …/wishes` | Công khai, vì lý do trên |
| `GET /api/invites/[id]/rsvp` (danh sách khách) | Chủ thiệp hoặc admin |
| `PUT /api/templates/[id]` | Chủ mẫu hoặc admin |
| `GET/POST /api/assets` | Cần đăng nhập; mỗi người chỉ thấy ảnh mình tải lên |

Vài chi tiết cố ý:

- **401 và 403 khác nhau.** 401 = chưa đăng nhập (client nên hiện form), 403 =
  đã đăng nhập nhưng không phải của mình (hiện form là vô nghĩa).
- **Sai mật khẩu và email không tồn tại trả cùng một thông báo.** Phân biệt hai
  trường hợp là tặng kẻ tấn công danh sách email có thật.
- **Giới hạn tần suất theo IP:** đăng nhập 8 lần/phút; đăng ký 5 lần/giờ; RSVP
  và lưu bút 6 lần/10 phút, mỗi loại một bộ đếm riêng (gửi RSVP không làm hết
  lượt lưu bút). Khách mời không có tài khoản nên đây là lớp chặn duy nhất cho
  hai API đó.

  `lib/ratelimit.ts` chọn nơi đếm theo `REDIS_URL` — có thì dùng Redis (đúng
  hạn mức dù chạy bao nhiêu instance), không có thì đếm trong bộ nhớ tiến
  trình (mặc định, đã kiểm trên bản production: 6 lượt qua, sau đó 429 kèm
  `retry-after`). Cả hai chạy chung một thuật toán sliding-window-log — Redis
  dùng sorted set (`ZADD`/`ZREMRANGEBYSCORE`/`ZCARD`), giữ đúng ngữ nghĩa với
  bản bộ nhớ. Một instance không Redis vẫn đúng như cấu hình; nhiều instance
  mà không đặt `REDIS_URL` thì hạn mức thực tế nhân lên theo số instance. Ở
  `next dev` bộ đếm bộ nhớ còn reset mỗi lần hot-reload.

  `/api/health` chạm thật vào bộ đếm rồi nói ra đang đếm ở đâu: đúng hạn mức,
  hạn mức nhân lên theo số instance, và Redis chết hẳn — nhìn từ ngoài ba thứ
  đó giống hệt nhau cho tới lúc bị lạm dụng thật.
- **`/quan-ly` chặn ngay ở server.** Kiểm tra ở client thì dữ liệu đã kịp gửi
  xuống trước khi giao diện kịp giấu đi.

### Tài khoản

Lần đầu chạy, seed tạo `admin@thiepcuoi.local` với **mật khẩu ngẫu nhiên in ra
log server một lần duy nhất** — mật khẩu mặc định đoán được là thứ đầu tiên bị
dò khi lỡ mở ra internet. Muốn đặt trước thì dùng `SEED_EMAIL` / `SEED_PASSWORD`.

Đổi mật khẩu bất cứ lúc nào:

```bash
npm run passwd -- admin@thiepcuoi.local          # sinh mật khẩu mạnh, in ra
npm run passwd -- admin@thiepcuoi.local 'tu-dat' # hoặc tự đặt
```

Đổi mật khẩu **không** thu hồi phiên đang đăng nhập; muốn buộc đăng nhập lại thì
xoá bảng `sessions`.

Ai cũng tự đăng ký được ở `/dang-ky` (`POST /api/auth/register`) — luôn tạo với
role `user`, không có đường nào tự phong `admin` từ giao diện. Đăng ký thành
công thì đăng nhập luôn, không cần xác nhận email (chưa có hạ tầng gửi mail).
Giới hạn 5 lần/giờ theo IP, kiểm dữ liệu ở `lib/register.ts` (email đúng định
dạng, mật khẩu ≥ 8 ký tự). Email trùng trả 409 kèm thông báo rõ ràng — không áp
dụng kiểu "thông báo chung chung" như đăng nhập, vì ở đây người dùng cần biết để
chuyển sang đăng nhập thay vì thử lại.

**Captcha tự host, không qua dịch vụ ngoài** (`lib/captcha.ts`). `GET
/api/captcha` sinh một phép cộng, ký bằng HMAC kèm hạn dùng 5 phút — toàn bộ
trạng thái nằm trong token trả về client, không cần bảng hay cache dùng chung.
Token dùng đúng một lần (chặn gửi lại câu trả lời đúng nhiều lần). Yếu hơn
hCaptcha/Turnstile trước bot có script nhắm riêng vào form này, nhưng không cần
tài khoản dịch vụ nào và chạy offline được — cùng lựa chọn với PGlite/scrypt.
Nhiều instance production muốn các instance xác minh được token của nhau thì
đặt `CAPTCHA_SECRET` dùng chung; không đặt thì mỗi tiến trình tự sinh secret
riêng, đủ dùng cho một instance hoặc dev.

## Ảnh

Byte nằm ở đâu là do `S3_BUCKET` quyết định: có thì dùng S3/R2, không thì đĩa
cục bộ (`.data/uploads`). `AssetKey` trong `TemplateDoc` không đổi theo kho.

Đổi kho rồi thì nhớ `npm run assets:migrate` — file cũ không tự đi theo, thiệp
đang trỏ tới ảnh cũ sẽ vỡ ảnh.

Chi tiết (biến môi trường cho R2, giới hạn tải lên, vì sao vẫn phục vụ qua
`/api/assets/`): [docs/assets.md](docs/assets.md).

## Ba điểm cần biết

**Thiệp = template + dữ liệu.** `/thiep/[slug]` nạp `docPacked` của template rồi
truyền `InviteData` của thiệp xuống renderer. Sửa lỗi trong mẫu là mọi thiệp
dùng mẫu đó được sửa theo; đổi tên cô dâu chú rể chỉ động vào bảng `invites`.

**Lời chúc trong form RSVP tự vào sổ lưu bút.** Khách không phải gõ hai lần, và
`Wishes` node hiện được ngay nội dung vừa gửi.

**`data: null` không dùng cho trang xem thử.** Ở mode `render`, token không
resolve được sẽ bị xoá thành rỗng, nên mẫu sẽ trống tên. Trang `/mau/[slug]`
truyền `placeholderInviteData()` — dữ liệu minh hoạ — chứ không truyền `null`.

## Lưu trữ

Postgres. Có `DATABASE_URL` thì dùng driver `pg`; không có thì dùng PGlite
(chính Postgres 18 biên dịch WASM) để dev/test không phải cài gì.

Chi tiết lược đồ, các bẫy đóng gói và cách chạy cục bộ: [docs/database.md](docs/database.md).

## Đưa lên chạy thật

Cấu hình toàn bộ bằng biến môi trường ([`.env.example`](.env.example)). Ở
production, thiếu `DATABASE_URL` hoặc `S3_*` là app **từ chối khởi động** — cố ý,
để biết ngay lúc deploy chứ không phải lúc khách mời bấm nút.

Quy trình, checklist và những chỗ dễ sai: [docs/deploy.md](docs/deploy.md).

## Còn thiếu

- Chưa có đăng ký tài khoản, đổi/quên mật khẩu.
- Rate limit dùng bộ nhớ tiến trình, chưa dùng được cho nhiều instance.
- Chưa có captcha; rate limit chặn được bơm hàng loạt nhưng không chặn được
  người kiên nhẫn.
- Chưa có CSRF token: đang dựa vào `SameSite=Lax`, đủ cho form thường nhưng nên
  thêm token khi có thao tác nhạy cảm hơn.
- Đổi slug thiệp không để lại chuyển hướng từ slug cũ.
- Chưa có xoá thiệp, và chưa có nhân bản thiệp.
- Chưa xoá được ảnh từ giao diện (`removeAsset` đã có ở lớp dưới), và chưa kiểm
  ảnh nào đang được mẫu nào dùng — nên chưa dọn được ảnh mồ côi.
