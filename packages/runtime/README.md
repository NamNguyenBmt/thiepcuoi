# @thiepcuoi/runtime

Renderer đọc `TemplateDoc` của `@thiepcuoi/schema` và vẽ ra React. **Editor và
trang thiệp công khai dùng chung đúng cây component này** — chỉ khác giá trị
`mode` trong context.

```
src/CanvasRenderer.tsx  khung canvas, scale, section, lazy-mount, hiệu ứng rơi, font
src/NodeShell.tsx       khung ngoài dùng chung cho mọi node
src/context.tsx         RuntimeProvider: assetBase, mode, data, submitRsvp, openMap…
src/style.ts            BaseProps → CSSProperties
src/animation.ts        entrance (IntersectionObserver) + continuous (keyframes)
src/html.ts             lọc HTML inline của TextBox
src/image.ts            chọn bề rộng ảnh xin từ CDN
src/registry.ts         NodeType → component
src/nodes/              12 component node (kèm envelope.tsx — bì thư mở màn)
```

## Dùng

```tsx
import { CanvasRenderer, RuntimeProvider } from '@thiepcuoi/runtime';
import { unpackDoc } from '@thiepcuoi/schema';

const doc = unpackDoc(template.docPacked);

<RuntimeProvider
  value={{
    assetBase: 'https://cdn.thiepcuoi.vn',
    mode: 'render',
    data: invite.data,
    submitRsvp: (p) => fetch(`/api/invites/${invite.id}/rsvp`, { method: 'POST', body: JSON.stringify(p) }).then(() => {}),
    wishes: invite.wishes,
  }}
>
  <CanvasRenderer doc={doc} />
</RuntimeProvider>
```

Trong editor: `mode: 'editor'` (tự bật `eager`, tắt animation, giữ token hiển thị,
chặn submit form và mở modal).

## Bốn quyết định đáng chú ý

**0. Bì thư dựng bằng CSS, không phải ảnh.** `nodes/envelope.tsx` vẽ nắp và
hai cánh bì bằng ba tam giác `border`, kích thước tính theo `calc()` từ hai
biến `--ew`/`--eh`. Một bảng CSS duy nhất phục vụ mọi bì thư, đổi màu là đổi
bốn biến — và lá thư trồi lên vẫn chui được từ *dưới* nắp lên *trên* nó, thứ
mà một tấm ảnh bì thư không làm được. Khi `lockScrollUntilOpened` bật, node
tự đi ngược cây DOM khoá mọi khung cuộn bao quanh nó rồi trả lại nguyên trạng
lúc mở — khoá mỗi `body` thì bản desktop (thiệp cuộn trong khung riêng) vẫn
trôi tuột qua màn chào.

**1. Hai lớp div mỗi node.** Animation vào (`transition`) và animation lặp
(`keyframes`) đều ghi vào `transform`. Để chung một phần tử thì cái sau đè cái
trước và node giật một cái khi vừa hiện ra. `NodeShell` tách: div ngoài giữ vị
trí + entrance, div trong giữ animation lặp.

**2. Scale một lần ở gốc.** `transform: scale()` đặt trên đúng một wrapper, không
nhân toạ độ từng node. Vì `transform` không đổi chiều cao bố cục nên phần tử
ngoài phải tự đặt `height = canvas.height * scale`. `scale` được cấp xuống context
để node xin CDN ảnh đúng bằng px thật đang hiển thị.

**3. Không tự gọi API.** Gửi RSVP, gửi lời chúc, mở bản đồ đều đi qua context.
Editor cắm bản giả, trang public cắm bản thật.

**4. An toàn cho SSR.** `TextProps.text` là HTML do người dùng nhập nên đi qua
`sanitizeInlineHtml` (allowlist thẻ + lọc `style`, chặn `url()`/`javascript:`).
Mọi thứ phụ thuộc thời gian hay ngẫu nhiên — đồng hồ đếm ngược, hiệu ứng rơi —
chỉ sinh trong `useEffect`, không render ở server, để không có hydration mismatch.

## Test

```bash
npm run typecheck && npm test
```

`src/smoke.test.tsx` render doc thử ra HTML tĩnh bằng `renderToStaticMarkup`
trong môi trường **không có DOM**. Component nào chạm `window`/`document` lúc
render sẽ làm test nổ — đúng thứ cần bắt vì trang thiệp chạy SSR.
