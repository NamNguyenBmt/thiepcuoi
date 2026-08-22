# Đưa lên chạy thật

## Cần gì

| Thứ | Ghi chú |
|---|---|
| Postgres | Neon, Supabase, RDS, hay tự dựng — chỉ cần một `DATABASE_URL` |
| Kho S3 | Cloudflare R2 rẻ nhất cho ảnh (không tính phí egress) |
| Nơi chạy Node | Bất cứ chỗ nào chạy được `node server.js` |

Toàn bộ cấu hình nằm trong biến môi trường — xem [`.env.example`](../.env.example).

## Bản standalone

`next.config.mjs` đặt `output: 'standalone'`, nên build ra một thư mục tự chứa:

```bash
npm run build
cp -r .next/static .next/standalone/apps/web/.next/static   # Next không tự chép
cd .next/standalone/apps/web && node server.js               # PORT, HOSTNAME đọc từ env
```

138 MB, chạy được bằng `node` trần, không cần `npm install` ở máy đích.

Ba chỗ dễ sai đã xử lý sẵn:

- **Editor phải cùng origin với API.** `npm run build` của web build luôn
  `apps/editor` vào `public/editor/`, và đặt `NEXT_PUBLIC_EDITOR_URL=/editor`.
  Editor gọi `/api` bằng đường dẫn tương đối rồi dựa vào cookie phiên — deploy
  nó sang domain khác là vừa gọi trượt API vừa mất luôn đăng nhập. Bỏ trống biến
  này thì các nút "mở trong editor" trỏ về `localhost:5173`, tức là chỉ chạy trên
  máy người dev, còn khách bấm vào thì gặp lỗi kết nối.
- **`lib/schema.sql` đọc bằng fs lúc chạy.** Next chỉ trace file JS, nên phải khai
  `outputFileTracingIncludes` — không thì bản standalone thiếu file và app chết
  ngay lúc migrate.
- **`.next/static` phải chép tay** vào `.next/standalone/apps/web/.next/static`,
  nếu không trang tải được HTML nhưng không có CSS/JS.
- **`outputFileTracingRoot` cố định về gốc repo.** Không đặt thì Next tự đoán,
  và cấu trúc standalone khác nhau giữa máy dev với image Docker — mọi đường
  dẫn trong Dockerfile sẽ trỏ trượt.

## Thứ tự làm

1. **Tạo database**, lấy `DATABASE_URL`.
2. **Tạo bucket R2**, tạo API token loại *Object Read & Write*, điền `S3_*`.
   Xem [assets.md](assets.md) để biết `S3_ENDPOINT` lấy ở đâu.
3. **Chuyển ảnh cũ** nếu trước đó đang lưu trên đĩa:
   `npm run assets:migrate -- --dry-run` rồi chạy thật.
4. **Deploy.** Lần chạy đầu tự tạo bảng và tạo tài khoản khởi tạo — **xem log
   server để lấy mật khẩu**, nó chỉ in một lần.
5. **Đổi mật khẩu ngay**: `npm run passwd -- <email>`.
6. **Kiểm `/api/health`** — nó chạm thật vào database và kho ảnh, không trả 200
   suông. Trỏ health check của hosting vào đây.

## Trước khi gửi link cho khách

- [ ] `/api/health` trả `ok: true`
- [ ] Mật khẩu khởi tạo đã đổi
- [ ] Mở một thiệp bằng máy khác, gửi thử một RSVP, xem nó hiện ở `/quan-ly`
- [ ] Ảnh hiện đúng (nếu vừa đổi kho, ảnh vỡ nghĩa là quên bước 3)
- [ ] Có backup database — thiệp cưới thì mất dữ liệu là mất thật

## Điều còn giới hạn

**Rate limit mặc định đếm trong bộ nhớ tiến trình.** Một instance thì đúng như
cấu hình. Chạy nhiều instance hoặc serverless thì đặt `REDIS_URL` để các
instance đếm chung — không đặt thì hạn mức thực tế nhân lên theo số instance.

**Ảnh phục vụ qua chính app** (`/api/assets/...`) vì tham số resize/crop mới là
thứ làm ảnh nhẹ đi. Đặt CDN trước đường dẫn đó là đủ, không phải sửa code.

**Dockerfile đã build và chạy thật** — xem mục cuối để biết kiểm được tới đâu.

## Docker

```bash
docker build -t thiepcuoi:latest .   # context là gốc repo, không phải apps/web
docker compose up -d                 # kèm Postgres + MinIO, web ở :3000
```

`docker compose up --build` cần **buildx >= 0.17**. Bản `docker.io` trong repo
Debian không kèm buildx, lúc đó dựng image trước rồi bảo compose dùng lại:

```bash
docker build -t thiepcuoi:latest .
docker compose up -d --no-build
```

Ba điểm đáng chú ý trong `Dockerfile` ở gốc repo:

- **Build diễn ra bên trong image**, không chép bản dựng sẵn từ máy phát triển
  vào. `sharp`, `pg` và `pglite` đều mang phần binary theo nền tảng: bản dựng
  trên Windows hay macOS đưa vào image Linux là hỏng lúc chạy. `.dockerignore`
  loại `node_modules` và `.next` để không lỡ tay mang chúng theo.
- **Context là gốc repo**, vì `apps/web` phụ thuộc `packages/*` qua `file:`.
- **Phải `npm install` trong cả ba package**, không chỉ `apps/web`, và **cài kèm
  devDependencies**. Hai lỗi thật gặp khi build image lần đầu:
  - Chỉ cài ở `apps/web` → `Can't resolve 'lzutf8'`: webpack biên dịch
    `packages/schema/src/*` thì tìm `node_modules` từ thư mục của chính package
    đó đi lên, không ngó sang `apps/web`.
  - Cài `--omit=dev` cho hai package → `Could not find a declaration file for
    module 'react'`: `next build` kiểm kiểu cả source của chúng, mà `@types/react`
    nằm ở devDependencies. Tầng runner chỉ chép bản standalone nên image cuối
    không mang theo chỗ nặng này.

  Máy dev không lộ hai lỗi trên vì `npm run install:all` đã cài đủ cho từng
  package từ trước.
- **HEALTHCHECK trỏ vào `/api/health`**, tức chạm thật vào database và kho ảnh.

`docker-compose.yml` dựng sẵn Postgres, MinIO và một container một-lần tạo bucket
trước khi web khởi động. Dùng để thử; production thật thì dùng Postgres và R2 có
sao lưu.

## Đã kiểm những gì

Bản standalone chạy trên PostgreSQL 17.6 thật + kho S3 (MinIO):
`/api/health` 200 với cả hai check OK, trang thiệp render 11 node kèm ảnh đọc từ
S3, `/quan-ly` chuyển hướng đúng khi chưa đăng nhập.

Phần Docker **đã build và chạy thật** (Docker 26.1.5 trong WSL Debian):

- `docker build` thành công sau khi sửa hai lỗi chỉ lộ ra khi build trong image
  (xem mục Docker ở trên). Image 364 MB.
- Container chạy: `/api/health` trả `ok: true` — database 147ms, S3 37ms;
  lược đồ được tạo và seed chạy ngay lần khởi động đầu, mật khẩu ngẫu nhiên in
  ra log đúng một lần.
- `/mau/co-ban` render 11 node; `HEALTHCHECK` của Docker báo `healthy`.
- `hadolint` không còn cảnh báo nào.
- **`docker compose up` chạy trọn vẹn.** `minio-init` tạo bucket xong thoát mã 0,
  cả ba container `postgres`/`minio`/`web` đều `healthy`, seed in mật khẩu ngẫu
  nhiên ở lần khởi động đầu. `localhost:3000` và MinIO console `localhost:9001`
  đều trả 200 từ phía Windows.

  Lần thử trước hỏng ở bước này — `minio-init` báo `dial tcp 172.20.0.2:9000:
  i/o timeout` — và đã bị chẩn đoán nhầm là "WSL không chạy được mạng bridge".
  Thực ra máy thử có hai backend firewall cùng lúc: `iptables` đang là bản
  *legacy* nên dockerd ghi rule ACCEPT vào bảng legacy, trong khi một ruleset
  *nft* cũ còn sót có `chain FORWARD` với `policy drop` và chỉ biết `docker0`.
  Kernel duyệt cả hai nên nft drop thắng — DNS phân giải đúng, chỉ TCP timeout.
  Sửa bằng `update-alternatives --set iptables /usr/sbin/iptables-nft` (và
  `ip6tables`) rồi khởi động lại dockerd để nó tự quản một backend duy nhất.
  Vậy `docker-compose.yml` không có vấn đề gì, và bridge trong WSL vẫn chạy
  bình thường; `--network=host` không cần thiết.

  Lưu ý cho máy thử: dockerd phải chạy dưới systemd (`systemctl start docker`).
  Gõ `dockerd` bằng tay sẽ khiến `systemctl restart docker` fail vì tranh
  `/var/run/docker.pid`.

- **Mẫu "Trọn vẹn" render đủ 11 section** trong container: bìa, nhà trai/nhà
  gái, cô dâu chú rể, hai tiệc cưới, hai nghi lễ, lịch + đếm ngược, lời mời,
  album, form xác nhận, QR mừng cưới, sổ lưu bút. Bắn tim ghi xuống bảng
  `reactions` (bấm 3 lần → `GET /api/invites/<id>/hearts` trả `{"hearts":3}`),
  lời chúc gửi từ thanh công cụ hiện ngay trong sổ lưu bút, modal mừng cưới mở
  đủ hai tài khoản kèm QR. Console không lỗi.
- Bố cục mobile kiểm bằng cách ép nhánh CSS `max-width` (khung dãn hết cột,
  trang tự cuộn, nhãn "Made with" ẩn) — **chưa** thử trên viewport nhỏ thật.

Chưa kiểm:

- Chạy nhiều instance, và chạy trên hosting thật.
- Nhạc nền: `doc.audio` đang để `null` vì chưa có file mp3 nào trong kho.
- Ảnh trong mẫu mồi là ảnh sinh bằng `sharp` (xem `lib/seed-assets.ts`), chưa
  thử với ảnh cưới thật do người dùng tải lên.
