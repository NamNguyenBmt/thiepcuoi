'use client';

/**
 * Bảng QR "quét để xem trên điện thoại".
 *
 * Thiệp cưới được thiết kế theo khung dọc 500px — xem trên máy tính thì đúng
 * nhưng nhỏ thỏn lỏn giữa màn hình rộng, và khách thường muốn mở tiếp trên
 * điện thoại để còn gửi cho người khác. Ảnh QR sinh sẵn ở server nên bảng này
 * không kéo thêm thư viện nào xuống trình duyệt.
 *
 * Chỉ hiện trên màn hình rộng: trên điện thoại thì khách đang cầm điện thoại rồi.
 */

import { useEffect, useState } from 'react';

export interface QrPanelProps {
  /** Ảnh QR dạng data URL, dựng ở server */
  qrDataUrl: string;
  url: string;
}

export function QrPanel({ qrDataUrl, url }: QrPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Quyết định ở client sau khi mount: server không biết màn hình rộng bao nhiêu
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => setOpen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!open || !qrDataUrl) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* trình duyệt chặn clipboard — khách vẫn quét được mã */
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 10001,
        width: 172,
        background: '#fff',
        borderRadius: 14,
        padding: 14,
        textAlign: 'center',
        boxShadow: '0 6px 24px rgba(90, 30, 30, 0.18)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Đóng mã QR"
        style={{
          position: 'absolute', top: 6, right: 8, border: 'none', background: 'none',
          fontSize: 14, lineHeight: 1, color: '#b3a5a2', cursor: 'pointer',
        }}
      >
        ✕
      </button>

      <img src={qrDataUrl} alt={`Mã QR mở thiệp: ${url}`} style={{ width: 132, height: 132 }} />
      <div style={{ fontSize: 11, color: '#8a7a77', lineHeight: 1.5, marginTop: 6 }}>
        Quét mã QR để xem
        <br />
        trên điện thoại
      </div>
      <button
        type="button"
        onClick={copy}
        style={{
          marginTop: 8, width: '100%', padding: '6px 0', fontSize: 12, fontFamily: 'inherit',
          border: '1px solid #efe4e2', borderRadius: 8, background: '#fdf6f4',
          color: '#7a2c2c', cursor: 'pointer',
        }}
      >
        {copied ? 'Đã chép liên kết' : 'Chép liên kết'}
      </button>
    </div>
  );
}
