# Ảnh: xử lý và nơi lưu

```
lib/storage.ts    kiểm định dạng, chuẩn hoá lúc tải lên, biến đổi lúc phục vụ (sharp)
lib/blobstore.ts  nơi chứa byte: đĩa cục bộ hoặc S3/R2
```

Hai file tách bạch có lý do: `AssetKey` trong `TemplateDoc` luôn là
`uploads/<uuid>.<ext>` bất kể byte nằm ở đâu. Đổi kho lưu trữ không phải đụng
tới mẫu thiệp nào, và cũng không phải viết lại phần xử lý ảnh.

## Chọn kho

| Có `S3_BUCKET` | Kho |
|---|---|
| có | S3, hoặc bất cứ thứ gì nói giao thức S3 — Cloudflare R2, MinIO, Backblaze B2 |
| không | đĩa cục bộ (`.data/uploads`) |

App in ra lúc dùng lần đầu: `[assets] đang dùng S3 bucket ... @ ...`.

### Biến môi trường

```
S3_BUCKET=thiepcuoi-assets
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto              # R2 không có region, tài liệu của họ bảo dùng "auto"
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=false   # đặt true cho MinIO và phần lớn S3 tự host
```

Với **Cloudflare R2**: tạo bucket, tạo API token loại *Object Read & Write*, rồi
điền như trên. Không cần đổi gì trong code.

## Chuyển ảnh cũ khi đổi kho

Đổi `S3_*` là app lập tức đọc/ghi ở kho mới, nhưng **file cũ vẫn nằm im trên
đĩa** — thiệp nào đang trỏ tới ảnh cũ sẽ vỡ ảnh. Chạy:

```bash
npm run assets:migrate -- --dry-run   # xem sẽ chuyển những gì
npm run assets:migrate
```

Script lấy danh sách từ bảng `assets` (không quét thư mục, để file rác không đi
theo), bỏ qua ảnh đã có ở kho đích, và **chỉ ghi thêm — không xoá bản gốc**, nên
chạy lại nhiều lần vô hại và vẫn lùi lại được.

## Vì sao vẫn đọc qua `/api/assets/...` chứ không trả thẳng URL của R2

Vì tham số biến đổi (`?resize=800x&format=webp`) mới là thứ làm ảnh nhẹ đi: một
tấm 1200×800 JPEG 5,9 KB ra 852 B WebP ở bề rộng thật đang hiển thị. Trả URL gốc
thì mọi máy đều tải bản đầy đủ.

Vì key chứa uuid nên nội dung dưới một URL không bao giờ đổi — response đặt
`cache-control: public, max-age=31536000, immutable`, và object trên S3 cũng
được đặt cùng header đó. Muốn nhẹ server hơn nữa thì đặt CDN trước
`/api/assets/`, không phải sửa code.

## Giới hạn khi tải lên

- Định dạng: JPEG, PNG, WebP, GIF. **Không nhận SVG** — nó là XML có thể chứa
  `<script>` và được phục vụ từ cùng origin với trang thiệp.
- Tối đa 12 MB, và ảnh lớn hơn 3000px bị thu lại (ảnh máy ảnh 6000px giữ nguyên
  chỉ tốn băng thông với RAM).
- Ảnh được xoay theo EXIF rồi bỏ thẻ orientation — thiếu bước này thì ảnh chụp
  dọc bằng điện thoại lên web sẽ nằm ngang.

## Chạy MinIO cục bộ (để thử nhánh S3 mà không cần tài khoản cloud)

```bash
.local/minio.exe server .local/minio-data --address 127.0.0.1:9000
```

Với `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` làm khoá truy cập. Cùng giao thức
với R2, nên nhánh code chạy được ở đây thì chạy được trên R2.
