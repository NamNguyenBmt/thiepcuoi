/**
 * Nhớ kết quả của một lần khởi tạo tốn kém (nối database, kho ảnh, Redis) —
 * nhưng **chỉ nhớ khi nó thành công**.
 *
 * `pending ??= create()` trần có một cái bẫy: lần đầu hỏng thì chính cái promise
 * bị từ chối đó nằm lại vĩnh viễn, nên mọi lời gọi sau đều nhận lại lỗi cũ dù
 * database đã sống lại từ lâu — phải khởi động lại tiến trình mới thoát. Ở
 * serverless, một lambda xui khởi động đúng lúc database chớp tắt sẽ hỏng suốt
 * vòng đời của nó, trong khi lambda bên cạnh vẫn chạy ngon.
 */
export interface Once<T> {
  get(): Promise<T>;
  /** Quên kết quả đã nhớ — dùng trong test để lần sau đọc lại biến môi trường */
  reset(): void;
}

export function once<T>(create: () => Promise<T>): Once<T> {
  let pending: Promise<T> | null = null;

  return {
    get: () =>
      (pending ??= create().catch((err) => {
        // Hỏng thì quên đi ngay, để lời gọi sau được thử lại từ đầu.
        // Gán ở đây chạy sau phép `??=` phía trên (một vòng microtask), nên
        // không có chuyện xoá nhầm promise vừa được gán vào.
        pending = null;
        throw err;
      })),

    reset: () => {
      pending = null;
    },
  };
}
