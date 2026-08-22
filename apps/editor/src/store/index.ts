import { createEditorStore } from './editorStore';
import { sampleDoc } from '../sample';

/**
 * Một instance store cho cả app. Khi có nhiều tab template mở song song thì
 * đổi sang context + store theo tab, chữ ký của các hook không phải sửa.
 */
export const useEditor = createEditorStore(sampleDoc());

export type { EditorState } from './editorStore';

// Chỉ ở dev: mở store ra window để soi lịch sử từ console khi gỡ lỗi.
if (import.meta.env.DEV) {
  (window as unknown as { __editor?: typeof useEditor }).__editor = useEditor;
}
