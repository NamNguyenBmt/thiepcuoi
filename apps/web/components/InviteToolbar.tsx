'use client';

/**
 * Thanh công cụ nổi dưới đáy trang thiệp.
 *
 * Gom ba việc mà khách hay làm nhất và không nằm gọn trong bố cục thiệp: gửi
 * lời chúc, bắn tim, mở thông tin mừng cưới. Để nổi bên ngoài canvas nên người
 * thiết kế mẫu không phải chừa chỗ cho chúng, và chúng luôn trong tầm ngón tay
 * dù khách đang cuộn tới đâu.
 *
 * Thu gọn được: có người chỉ muốn xem thiệp cho sạch mắt.
 */

import { useEffect, useRef, useState } from 'react';

export interface InviteToolbarProps {
  hearts: number;
  onHeart: () => void;
  onSendWish: (wish: { name: string; message: string }) => Promise<void>;
  /** Không có thiệp thật (đang xem thử mẫu) thì mọi thứ chỉ để nhìn */
  readOnly?: boolean;
}

const WINE = '#7a2c2c';
const ROSE = '#e8a0a0';

/** Rút gọn 1234 thành "1.2k" — chỗ hiển thị chỉ rộng bằng một ngón tay */
function short(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function InviteToolbar({ hearts, onHeart, onSendWish, readOnly = false }: InviteToolbarProps) {
  const [open, setOpen] = useState(true);
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (composing) nameRef.current?.focus();
  }, [composing]);

  async function send() {
    if (readOnly || state === 'sending') return;
    if (!name.trim() || !message.trim()) return;
    setState('sending');
    try {
      await onSendWish({ name: name.trim(), message: message.trim() });
      setName('');
      setMessage('');
      setState('done');
      setComposing(false);
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('error');
    }
  }

  const pill: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 38,
    padding: '0 14px',
    borderRadius: 19,
    border: 'none',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: readOnly ? 'default' : 'pointer',
    background: 'rgba(255,255,255,0.92)',
    color: WINE,
    boxShadow: '0 2px 10px rgba(90, 30, 30, 0.16)',
    whiteSpace: 'nowrap',
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hiện thanh công cụ"
        style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10001, ...pill, cursor: 'pointer',
        }}
      >
        ❤ Lời chúc &amp; bắn tim
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      {composing && (
        <div
          style={{
            width: 300,
            maxWidth: 'calc(100vw - 32px)',
            background: '#fff',
            borderRadius: 14,
            padding: 12,
            boxShadow: '0 6px 24px rgba(90, 30, 30, 0.22)',
          }}
        >
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên của bạn"
            maxLength={120}
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '8px 10px',
              fontSize: 13, fontFamily: 'inherit', border: '1px solid #e6dcda', borderRadius: 8,
            }}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Gửi lời chúc tới cô dâu chú rể…"
            maxLength={2000}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '8px 10px',
              fontSize: 13, fontFamily: 'inherit', border: '1px solid #e6dcda', borderRadius: 8,
              resize: 'vertical',
            }}
          />
          {state === 'error' && (
            <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 6 }}>
              Gửi không được, bạn thử lại giúp nhé.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setComposing(false)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontFamily: 'inherit',
                border: '1px solid #e6dcda', borderRadius: 8, background: '#fff',
                color: '#7d6f6c', cursor: 'pointer',
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={send}
              disabled={state === 'sending' || !name.trim() || !message.trim()}
              style={{
                flex: 2, padding: '8px 0', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
                border: 'none', borderRadius: 8, background: WINE, color: '#fff',
                cursor: 'pointer', opacity: state === 'sending' || !name.trim() || !message.trim() ? 0.55 : 1,
              }}
            >
              {state === 'sending' ? 'Đang gửi…' : 'Gửi lời chúc'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => !readOnly && setComposing((v) => !v)}
          style={{ ...pill, color: '#8a7a77' }}
        >
          ✎ {state === 'done' ? 'Đã gửi, cảm ơn bạn!' : 'Gửi lời chúc…'}
        </button>

        <button
          type="button"
          onClick={() => !readOnly && onHeart()}
          aria-label="Bắn tim"
          style={{ ...pill, background: ROSE, color: '#fff', fontWeight: 600 }}
        >
          ❤ Bắn tim
          <span
            style={{
              marginLeft: 2, padding: '1px 7px', borderRadius: 10,
              background: 'rgba(255,255,255,0.28)', fontSize: 12,
            }}
          >
            {short(hearts)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Thu nhỏ thanh công cụ"
          style={{ ...pill, width: 38, padding: 0, justifyContent: 'center', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
