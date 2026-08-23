import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { resolveTokens } from '@thiepcuoi/schema';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl } from '../image';
import type { RsvpPayload } from '../context';

/**
 * Form RSVP.
 *
 * Trạng thái nằm ngay trong component — mỗi thiệp chỉ có một form, không cần
 * form library. Việc gửi đi uỷ quyền cho `submitRsvp` của context.
 */
export function RsvpFormNode({ node }: NodeProps<'RsvpForm'>) {
  const { submitRsvp, mode } = useRuntime();
  const p = node.props;

  const [name, setName] = useState('');
  const [attending, setAttending] = useState(true);
  const [count, setCount] = useState(1);
  const [side, setSide] = useState<'groom' | 'bride' | null>(null);
  const [transport, setTransport] = useState<'self' | 'pickup' | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const label: CSSProperties = { fontSize: p.fontSize * 0.8, opacity: 0.8, display: 'block', marginBottom: 4 };
  /**
   * Ô nhập KHÔNG kế thừa font của khối.
   *
   * Nhãn và tiêu đề đi theo thiết kế của mẫu, kể cả font thư pháp. Nhưng thứ
   * khách vừa gõ thì họ phải đọc lại được để soát trước khi gửi — tên viết
   * bằng nét thư pháp nghiêng là không soát nổi. Đây là chỗ chức năng thắng
   * thẩm mỹ, nên khoá cứng về font hệ thống.
   */
  const field: CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: p.fontSize * 0.8,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    color: p.color,
    background: 'transparent',
    border: `1px solid ${p.borderColor || '#e0e0e0'}`,
    borderRadius: 6,
    marginBottom: 12,
    boxSizing: 'border-box',
  };
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: p.fontSize * 0.8 };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'editor' || state === 'sending') return;
    const payload: RsvpPayload = {
      name: name.trim(),
      attending,
      attendeeCount: attending ? count : 0,
      guestSide: side,
      transportation: transport,
      pickupSlotId: slot,
      message: message.trim(),
    };
    setState('sending');
    try {
      await submitRsvp(payload);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <NodeShell id={node.id} p={p} innerStyle={{ display: 'grid', placeItems: 'center', fontFamily: p.fontFamily, color: p.color, textAlign: 'center', fontSize: p.fontSize }}>
        {p.successText}
      </NodeShell>
    );
  }

  return (
    <NodeShell
      id={node.id}
      p={p}
      innerStyle={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.color, overflowY: 'auto' }}
    >
      <form onSubmit={onSubmit}>
        <div style={{ fontSize: p.fontSize * 1.15, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
          {p.titleText}
        </div>

        <label style={label} htmlFor={`${node.id}-name`}>{p.nameLabel}</label>
        <input
          id={`${node.id}-name`}
          style={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <span style={label}>{p.attendLabel}</span>
        <label style={row}>
          <input type="radio" name={`${node.id}-att`} checked={attending} onChange={() => setAttending(true)} />
          {p.attendYesText}
        </label>
        <label style={{ ...row, marginBottom: 12 }}>
          <input type="radio" name={`${node.id}-att`} checked={!attending} onChange={() => setAttending(false)} />
          {p.attendNoText}
        </label>

        {p.enableAttendeeCount && attending && (
          <>
            <label style={label} htmlFor={`${node.id}-count`}>{p.attendeeCountLabel}</label>
            {/* Danh sách chọn thay vì ô số: trên điện thoại nó là một cú chạm,
                còn ô số thì bật bàn phím lên và cho gõ cả "0" lẫn "999". */}
            <select
              id={`${node.id}-count`}
              style={field}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{`${n} người`}</option>
              ))}
            </select>
          </>
        )}

        {p.enableGuestSide && (
          <>
            <span style={label}>{p.guestSideLabel}</span>
            <label style={row}>
              <input type="radio" name={`${node.id}-side`} checked={side === 'groom'} onChange={() => setSide('groom')} />
              {p.guestSideGroomText}
            </label>
            <label style={{ ...row, marginBottom: 12 }}>
              <input type="radio" name={`${node.id}-side`} checked={side === 'bride'} onChange={() => setSide('bride')} />
              {p.guestSideBrideText}
            </label>
          </>
        )}

        {p.enableTransportation && attending && (
          <>
            <span style={label}>{p.transportationLabel}</span>
            <label style={row}>
              <input type="radio" name={`${node.id}-tr`} checked={transport === 'self'} onChange={() => setTransport('self')} />
              {p.transportationSelfText}
            </label>
            <label style={{ ...row, marginBottom: 12 }}>
              <input type="radio" name={`${node.id}-tr`} checked={transport === 'pickup'} onChange={() => setTransport('pickup')} />
              {p.transportationPickupText}
            </label>
            {transport === 'pickup' && p.pickupTimeSlots.length > 0 && (
              <>
                <label style={label} htmlFor={`${node.id}-slot`}>{p.pickupDateTimeLabel}</label>
                <select
                  id={`${node.id}-slot`}
                  style={field}
                  value={slot ?? ''}
                  onChange={(e) => setSlot(e.target.value || null)}
                >
                  <option value="">—</option>
                  {p.pickupTimeSlots.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </>
            )}
          </>
        )}

        {p.enableMessage && (
          <>
            <label style={label} htmlFor={`${node.id}-msg`}>{p.messageLabel}</label>
            <textarea
              id={`${node.id}-msg`}
              style={{ ...field, minHeight: 64, resize: 'vertical' }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </>
        )}

        {state === 'error' && (
          <div style={{ fontSize: p.fontSize * 0.8, color: '#c0392b', marginBottom: 8 }}>
            Gửi không thành công, bạn thử lại giúp nhé.
          </div>
        )}

        <button
          type="submit"
          disabled={state === 'sending'}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: p.fontSize * 0.9,
            fontFamily: 'inherit',
            fontWeight: 600,
            color: p.buttonTextColor,
            background: p.buttonColor,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            opacity: state === 'sending' ? 0.6 : 1,
          }}
        >
          {state === 'sending' ? 'Đang gửi…' : p.submitText}
        </button>
      </form>
    </NodeShell>
  );
}

export function WishesNode({ node }: NodeProps<'Wishes'>) {
  const { wishes } = useRuntime();
  const p = node.props;
  const shown = wishes.slice(0, p.maxVisible);

  return (
    <NodeShell
      id={node.id}
      p={p}
      innerStyle={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.color, overflowY: 'auto' }}
    >
      <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 10, fontSize: p.fontSize * 1.15 }}>
        {p.titleText}
      </div>
      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', opacity: 0.6 }}>{p.emptyText}</div>
      ) : (
        shown.map((w) => (
          <div key={w.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontWeight: 600 }}>{w.name}</div>
            <div style={{ opacity: 0.85, whiteSpace: 'pre-wrap' }}>{w.message}</div>
          </div>
        ))
      )}
    </NodeShell>
  );
}

export function MapNode({ node }: NodeProps<'Map'>) {
  const { openMap, mode, data } = useRuntime();
  const p = node.props;

  // `query` là nơi template trỏ tới địa chỉ của thiệp, ví dụ "{{events.0.venue}}".
  // Không resolve ở đây thì nút chỉ đường mở Google Maps với đúng chuỗi ngoặc
  // nhọn đó — tìm ra một kết quả rỗng, và không ai báo lỗi cho mình biết.
  const query = resolveTokens(p.query, data, mode);
  const label = resolveTokens(p.label, data, mode);

  if (p.mode === 'embed') {
    const q = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : query;
    return (
      <NodeShell id={node.id} p={p}>
        {mode === 'render' && q ? (
          <iframe
            title={label}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`}
            style={{ width: '100%', height: '100%', border: 0, borderRadius: 'inherit' }}
            loading="lazy"
          />
        ) : null}
      </NodeShell>
    );
  }

  return (
    <NodeShell id={node.id} p={p}>
      <button
        type="button"
        onClick={() => mode === 'render' && openMap({ lat: p.lat, lng: p.lng, query })}
        style={{
          width: '100%',
          height: '100%',
          fontFamily: p.fontFamily,
          fontSize: p.fontSize,
          color: p.color,
          background: p.buttonColor,
          border: 'none',
          borderRadius: 'inherit',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </NodeShell>
  );
}

export function GiftQrNode({ node }: NodeProps<'GiftQr'>) {
  const { assetBase, dpr, mode, data } = useRuntime();
  const p = node.props;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Số tài khoản là dữ liệu của từng cặp đôi, không phải của thiết kế. Template
  // để trống thì lấy từ `InviteData` — nếu không, mọi thiệp dùng chung mẫu này
  // sẽ chuyển tiền vào tài khoản của người đầu tiên dựng mẫu.
  const accounts = p.accounts.length > 0 ? p.accounts : (data?.accounts ?? []);

  const icon = imageUrl(assetBase, p.imgKey, p.width, dpr, { format: 'png' });

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard bị chặn — người dùng vẫn đọc được số trên màn hình */
    }
  }

  return (
    <>
      <NodeShell id={node.id} p={p} flipX={p.flipX} flipY={p.flipY}>
        <button
          type="button"
          onClick={() => mode === 'render' && setOpen(true)}
          aria-label={p.modalTitle}
          style={{
            all: 'unset',
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            backgroundImage: icon ? `url("${icon}")` : undefined,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }}
        />
      </NodeShell>

      {open && (
        <Overlay>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={p.modalTitle}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.55)',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              maxWidth: 360,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>{p.modalTitle}</div>
            {accounts.map((acc) => (
              <div key={acc.id} style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{acc.displayName}</div>
                {acc.qrCode && (
                  <img
                    src={imageUrl(assetBase, acc.qrCode, 240, dpr, { format: 'png' })}
                    alt={`QR ${acc.displayName}`}
                    style={{ width: 200, height: 200, objectFit: 'contain' }}
                  />
                )}
                <div style={{ fontSize: 13, marginTop: 8 }}>{acc.bank}</div>
                <div style={{ fontSize: 13 }}>{acc.name}</div>
                <button
                  type="button"
                  onClick={() => copy(acc.accountNumber, acc.id)}
                  style={{
                    marginTop: 6,
                    padding: '6px 12px',
                    fontSize: 13,
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    background: '#fafafa',
                    cursor: 'pointer',
                  }}
                >
                  {copied === acc.id ? 'Đã chép' : acc.accountNumber}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ width: '100%', padding: 10, border: 'none', borderRadius: 8, background: '#eee', cursor: 'pointer' }}
            >
              Đóng
            </button>
          </div>
        </div>
        </Overlay>
      )}
    </>
  );
}

/**
 * Đưa lớp phủ ra thẳng `document.body`.
 *
 * Canvas đặt `transform: scale()` lên khung vẽ, mà phần tử có transform thì
 * trở thành gốc toạ độ cho mọi `position: fixed` bên trong nó — cộng thêm
 * `overflow: hidden` của canvas nữa là modal bị nhốt và cắt cụt trong khung
 * thiệp thay vì phủ kín màn hình. Portal là cách duy nhất thoát ra.
 */
function Overlay({ children }: { children: ReactNode }) {
  // Chỉ tồn tại ở client; server render ra null rồi effect gắn vào sau.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
