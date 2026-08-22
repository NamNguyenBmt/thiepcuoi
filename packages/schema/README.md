# @thiepcuoi/schema

Định dạng dữ liệu cho editor thiệp cưới của ThiepCuoiOnline.

```
src/types.ts      — toàn bộ kiểu dữ liệu (nguồn sự thật duy nhất)
src/defaults.ts   — giá trị mặc định + factory tạo node
src/serialize.ts  — nén/giải nén, migration, validate, asset URL, token binding
```

## 1. Mô hình

```
TemplateDoc
├── canvas      { baseWidth: 500, height, background }
├── sections[]  { id, name, top, height, background }   ← lớp mà cinelove không có
├── order[]     thứ tự vẽ khi zIndex bằng nhau
├── nodes{}     Record<id, TemplateNode>  — phẳng, toạ độ tuyệt đối
├── fonts[]     khai báo font phải load
├── audio       nhạc nền
└── effects     hiệu ứng rơi (tim / cánh hoa / tuyết)
```

Node **phẳng, không lồng nhau**. Đây là lựa chọn có chủ đích, không phải giới hạn:
với thiệp cưới thì mọi phần tử đều được kéo thả tự do, không có flow layout, nên
cây lồng nhau chỉ tốn chi phí duyệt mà chẳng dùng đến. Muốn nhóm phần tử thì dùng
`sectionId` + multi-select trong editor, không cần group node.

### Vì sao thêm `sections`

CineLove để 93 node phẳng cùng một mức, cảm giác "trang" chỉ do ảnh nền cao ~750px
xếp nối nhau. Hệ quả:

- không lazy-render được → phải mount hết 90+ node ngay từ đầu;
- không biết node nào thuộc "màn" nào để chạy animation theo lô;
- người dùng chèn thêm nội dung ở giữa phải tự tay kéo lại toạ độ tất cả node bên dưới.

Có `sections`, editor làm được: chèn/xoá/đổi thứ tự section rồi **dịch `top` của mọi
node bên dưới một lượt**, renderer thì chỉ mount section đang ở gần viewport.

### Vì sao tách `InviteData` khỏi `TemplateDoc`

CineLove nướng thẳng nội dung vào `TextProps.text` ("Nguyễn Vinh Quang"). Mỗi thiệp
của mỗi khách là một bản sao 90 KB, và sửa lỗi chính tả trong mẫu gốc không lan
xuống các thiệp đã tạo.

Ở đây `text` chứa token:

```
"Trân trọng báo tin lễ thành hôn của {{groom.fullName}}"
```

- `collectTokens(doc)` → sinh form nhập liệu động cho người dùng cuối;
- `resolveTokens(text, data)` → thay lúc render;
- bảng `invites` chỉ lưu `InviteData` (~2 KB) + `template_id`, không sao chép doc.

Node ảnh dùng cơ chế tương tự qua `PhotoProps.slot`.

## 2. Chuẩn hoá kích thước

Thiết kế luôn ở `canvas.baseWidth = 500`. Runtime:

```ts
const scale = containerWidth / doc.canvas.baseWidth;
// <div style={{ width: baseWidth, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
```

Chỉ scale **một** wrapper duy nhất — không nhân toạ độ từng node. Nhờ vậy font,
border-radius, shadow co giãn đồng bộ và editor không cần biết gì về màn hình thật.

## 3. Prop đầy đủ, không optional

Mọi node lưu xuống DB đều có đủ 100% prop (xem `NODE_DEFAULTS`). Renderer không
bao giờ phải `?? defaultValue`. Khi thêm prop mới: tăng `SCHEMA_VERSION`, thêm
default — `migrate()` tự bù cho doc cũ lúc load, không cần backfill DB.

## 4. Nén

`packDoc` / `unpackDoc` dùng **lzutf8** (base64). Doc đầy đủ ~120 KB → ~25 KB.
Đổi codec chỉ cần sửa 2 hàm đó; `schemaVersion` nằm trong JSON nên không ảnh
hưởng tới việc chọn codec.

## 5. Bảng DB gợi ý

| Bảng | Cột chính |
|---|---|
| `templates` | `id, slug, name, category_id, doc_packed (text), thumbnail, status, sort_order` |
| `invites` | `id, template_id, owner_id, slug, data (jsonb = InviteData), overrides (jsonb), published_at` |
| `rsvps` | `id, invite_id, name, attending, attendee_count, guest_side, message, created_at` |
| `assets` | `id, owner_id, key, mime, width, height, bytes` |

`invites.overrides` cho trường hợp người dùng sửa hẳn thiết kế (đổi màu, xoá một
node): lưu **patch theo node id**, không lưu cả doc.

## 6. Kiến trúc editor

```
apps/editor
├── store/          zustand + immer: { doc, selection[], hoverId, clipboard, history }
├── canvas/         khung vẽ, ruler, snap guide, marquee select
├── nodes/          1 component render + 1 component inspector cho mỗi NodeType
├── panels/         Layers · Inspector · Assets · Fonts · Sections
└── runtime/        renderer dùng chung với trang thiệp công khai
```

Vài điểm cần chốt sớm:

- **Một renderer duy nhất** cho editor và trang public. Editor chỉ bọc thêm lớp
  chọn/kéo ở trên (`pointer-events` overlay), tuyệt đối không viết 2 bản render —
  đây là nguồn sai lệch WYSIWYG kinh điển.
- **Undo/redo**: patch của immer, gộp các thao tác kéo liên tiếp trong 300 ms
  thành một bước.
- **Snap**: so cạnh và tâm với node cùng section + tâm canvas, ngưỡng 4px (ở toạ
  độ canvas, tức chia cho `scale`).
- **Animation lúc chỉnh sửa phải tắt**. `transition.effectEnabled` chỉ có tác
  dụng ở runtime; trong editor luôn render trạng thái cuối.
- **Font**: `doc.fonts` là danh sách phải load. `validateDoc` báo lỗi nếu có node
  dùng font chưa khai báo — lỗi này rất hay xảy ra khi copy node giữa 2 mẫu.

## 7. Dùng thử

```ts
import { createEmptyDoc, createNode, packDoc, unpackDoc, validateDoc } from '@thiepcuoi/schema';

const doc = createEmptyDoc('tpl_1', 'Mẫu thử', 'mau-thu');
const title = createNode('Text', 'sec-1', {
  text: '{{groom.shortName}} & {{bride.shortName}}',
  top: 80, left: 50, width: 400, fontFamily: 'Quicksand', fontSize: 36,
});
doc.nodes[title.id] = title;
doc.order.push(title.id);
doc.fonts.push({ family: 'Quicksand', source: { kind: 'google', name: 'Quicksand' }, weights: [400, 500, 700] });

console.log(validateDoc(doc));          // []
const packed = packDoc(doc);            // lưu vào templates.doc_packed
const back = unpackDoc(packed);         // đọc ra, đã migrate
```
