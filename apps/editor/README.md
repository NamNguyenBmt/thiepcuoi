# @thiepcuoi/editor

Editor kéo thả cho template thiệp cưới. Đọc/ghi `TemplateDoc` của
`@thiepcuoi/schema`, hiển thị bằng `CanvasRenderer` của `@thiepcuoi/runtime`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build → apps/web/public/editor
```

Bản build đi thẳng vào `public/` của web và được phục vụ ở `/editor`, tức là
**cùng origin với API** — bắt buộc, vì editor gọi `/api` bằng đường dẫn tương
đối và dựa vào cookie phiên. `npm run build` của web tự chạy bước này, không
phải build tay.

```
src/store/history.ts     undo/redo bằng patch của immer + gộp thao tác
src/store/editorStore.ts zustand: doc, selection, zoom, clipboard, mọi hành động sửa
src/canvas/EditorCanvas.tsx  overlay chọn / kéo / co giãn / quét chọn + phím tắt
src/canvas/snapping.ts   bắt dính cạnh & tâm, sinh đường gióng
src/panels/Toolbar.tsx   thêm node (sinh từ NODE_REGISTRY), undo/redo, zoom, lưu
src/panels/LayersPanel.tsx   cây section → node, khoá/ẩn, sửa chiều cao section
src/panels/InspectorPanel.tsx  thuộc tính chung + riêng theo NodeType
src/sample.ts            doc mẫu để mở lên là nghịch được ngay
```

## Nạp và lưu mẫu

Editor gọi API của `apps/web` qua proxy của Vite (`/api` → `localhost:3000`),
nên không cần bật CORS và khi hai app deploy chung domain thì code không đổi.

- Mở editor → `GET /api/templates` rồi `GET /api/templates/[id]`. Mở mẫu cụ thể
  bằng `?template=<slug>`.
- Web chưa chạy? Vẫn vào được, chỉnh trên doc mẫu cục bộ, nút Lưu tắt và có
  banner báo lý do — không chặn cả giao diện chỉ vì một request hỏng.
- Nút Lưu → `PUT /api/templates/[id]` kèm `revision`. Server trả 409 nếu tab
  khác đã lưu trong lúc đó, 422 nếu doc không qua được `validateDoc`; cả hai đều
  hiện nguyên văn lý do ở thanh trạng thái.

## Chọn và tạo mẫu

Ô chọn mẫu ở đầu thanh công cụ liệt kê mọi mẫu trên server; đổi mẫu là nạp lại
và **xoá sạch lịch sử undo**, nên nếu đang có thay đổi chưa lưu thì editor hỏi
lại trước — mất công kéo thả cả buổi vì lỡ tay chọn nhầm là quá đắt.

Nút **+ Mẫu mới** tạo canvas trống, hoặc nhân bản mẫu đang mở. Mở thẳng một mẫu
cụ thể bằng `?template=<slug>` — đây cũng là link mà trang `/quan-ly` của web
dùng.

## Đăng nhập

Form nhỏ ở góc phải thanh công cụ. Cookie phiên do `apps/web` đặt; editor chạy
cổng khác nhưng cookie không phân biệt cổng, cộng thêm proxy `/api` nên trình
duyệt tự gửi kèm — không cần token riêng.

Chưa đăng nhập vẫn mở và kéo thả được, chỉ **Lưu** và **Thư viện ảnh** là cần
tài khoản; server trả 401/403 và thanh trạng thái nói rõ lý do. Chặn cả editor
ngay từ đầu chỉ làm khó người dùng mà không bảo vệ thêm được gì — server mới là
chỗ chặn thật.

## Thư viện ảnh

Nút **Thư viện ảnh** trên thanh công cụ, hoặc nút **Chọn…** ở các ô ảnh trong
Inspector (Ảnh, Mask, Hoạ tiết, Icon mừng cưới, Icon đánh dấu lịch). Album có ô
riêng cho phép chọn nhiều ảnh một lúc.

Kéo thả file vào hộp thoại là tải lên luôn. Ảnh vừa tải được chọn sẵn — gần như
luôn là thứ người dùng đang cần.

Ô ảnh vẫn giữ ô nhập chuỗi bên dưới: hoạ tiết hệ thống không nằm trong thư viện
upload, và khi debug thì gõ thẳng key là nhanh nhất.

## Kiến trúc

**Renderer không biết đến editor.** `EditorCanvas` đặt `CanvasRenderer` (mode
`'editor'`) xuống dưới, rồi phủ một lớp overlay trong suốt lên trên để bắt chuột.
Không có bản render thứ hai, nên WYSIWYG không thể lệch — thứ người dùng kéo
chính xác là thứ khách mời sẽ thấy.

**Toạ độ.** Overlay quy mọi điểm chuột về hệ toạ độ canvas (`(client - stage) / zoom`)
rồi mới hit-test, nên zoom bao nhiêu cũng không ảnh hưởng tới logic chọn/kéo.
Hit-test đi ngược thứ tự vẽ (`zIndex`, rồi vị trí trong `order`) để lấy node trên cùng.

**Undo/redo lưu patch, không lưu bản sao doc.** Kéo một node 200 lần tốn vài KB
thay vì 200 × 120 KB. Các thay đổi cùng `coalesceKey` trong vòng 400 ms được gộp
thành một bước — nếu không, một cú kéo chuột sẽ đẻ ra hàng trăm bước undo.

**Section là đơn vị bố cục.** Đổi chiều cao một section thì mọi section bên dưới
*và node của chúng* dịch theo, `canvas.height` cập nhật luôn. Kéo node qua ranh
giới thì `sectionId` của nó tự đổi.

**Thanh công cụ sinh từ `NODE_REGISTRY`.** Thêm loại node mới vào schema +
runtime là nó tự xuất hiện trong editor, không có chuyện quên.

## Phím tắt

| Phím | Việc |
|---|---|
| `Ctrl+Z` / `Ctrl+Shift+Z` | Hoàn tác / làm lại |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+D` | Chép / dán / nhân bản |
| `Delete` | Xoá phần tử đang chọn |
| `↑ ↓ ← →` | Nhích 1px (giữ `Shift`: 10px) |
| `Shift` + click | Thêm/bớt khỏi vùng chọn |
| `Shift` khi co giãn | Khoá tỉ lệ |
| `Esc` | Bỏ chọn |

Kéo trên vùng trống = quét chọn nhiều node. Đường gióng đỏ hiện khi cạnh hoặc
tâm node thẳng hàng với node khác, hoặc với trục giữa canvas.

## Còn thiếu

- Chưa sửa chữ trực tiếp trên canvas (hiện sửa trong Inspector).
- Chưa kéo thả đổi thứ tự trong panel Layers (đã có nút đưa lên/xuống lớp).
- Chưa cảnh báo khi rời trang lúc còn thay đổi chưa lưu.
- Thư viện ảnh chưa có xoá, đổi tên hay tìm kiếm.
