import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { resolveTokens } from '@thiepcuoi/schema';
import type { PropsOf } from '@thiepcuoi/schema';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl } from '../image';
import type { RsvpPayload, Wish } from '../context';

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

        {/*
          Nút gửi DÍNH ĐÁY khung.

          Khung form cao cố định theo thiết kế của mẫu, còn chiều cao thật của
          nội dung thì đổi theo số câu hỏi được bật: chủ thiệp bật thêm ô lời
          chúc hay mục xe đưa đón là nội dung dài ra, và cái nút — thứ duy nhất
          khách bắt buộc phải chạm — bị mép dưới cắt làm đôi. Nhìn như hỏng, và
          khách không biết là cuộn trong khung thì thấy tiếp.

          `sticky` chỉ ghim khi thật sự có phần tràn; vừa khít thì nó nằm đúng
          chỗ cũ trong dòng chảy, không mẫu nào đang chạy bị xê dịch.
        */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            paddingTop: 8,
            // Không có nền thì các ô nhập trôi qua phía sau nút, lộ ra ở khe hở
            background: p.backgroundColor || 'transparent',
          }}
        >
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
        </div>
      </form>
    </NodeShell>
  );
}

/**
 * Sổ lưu bút: đọc lời chúc của khách, và gửi lời chúc mới ngay tại chỗ.
 *
 * Trước đây khối này chỉ đọc — muốn gửi thì phải tìm tới thanh nổi dưới đáy
 * trang. Nhưng chỗ khách muốn viết là chỗ họ vừa đọc lời chúc của người khác,
 * chứ không phải một cái nút trôi nổi không dính gì tới bố cục thiệp.
 *
 * Ô nhập GẬP LẠI thay vì hiện sẵn: khối này nằm trong khung cao cố định do
 * người thiết kế đặt, một cái form mở toang sẽ đẩy hết danh sách xuống dưới
 * mép — mà chính danh sách mới là thứ khiến người ta muốn viết thêm vào. Trừ
 * đúng một trường hợp: sổ chưa có ai viết, lúc đó chẳng có danh sách nào để
 * che cả.
 */
export function WishesNode({ node }: NodeProps<'Wishes'>) {
  const { wishes, submitWish, mode } = useRuntime();
  const p = node.props;

  /*
   * Sổ còn trắng thì mở sẵn ô nhập.
   *
   * Khung này cao cố định theo thiết kế của mẫu: chưa ai viết thì nó là một ô
   * trống to đùng với đúng một cái nút ở giữa. Mở sẵn ô nhập vừa lấp chỗ trống
   * đó, vừa nói thẳng ra việc cần làm — người mở sổ đầu tiên là người ngại
   * nhất, đừng bắt họ bấm thêm một nhịp nữa.
   */
  const [composing, setComposing] = useState(
    () => mode === 'render' && p.enableForm && wishes.length === 0,
  );
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  /*
   * Đưa con trỏ vào ô tên, nhưng CHỈ khi khách tự mở ô nhập.
   *
   * Sổ trống thì ô nhập mở sẵn ngay từ lần vẽ đầu — focus vào đó là trình duyệt
   * kéo cả trang xuống chỗ khối này, trong khi khách còn đang xem dở phần trên.
   * Bỏ qua lần đầu, những lần sau mới là do khách bấm nút.
   */
  useEffect(() => {
    if (composing && opened.current) nameRef.current?.focus();
    opened.current = true;
  }, [composing]);

  // Trong editor danh sách luôn rỗng — không có thiệp thật thì không ai gửi gì.
  // Đưa vài lời chúc mẫu vào để người dựng mẫu thấy đúng chiều cao một thẻ,
  // thay vì canh khung theo mỗi dòng "chưa có lời chúc nào".
  const list = mode === 'editor' && wishes.length === 0 ? PREVIEW_WISHES : wishes;
  const shown = expanded ? list : list.slice(0, Math.max(1, p.maxVisible));
  const rest = list.length - shown.length;

  async function send() {
    if (mode === 'editor' || state === 'sending') return;
    if (!name.trim() || !message.trim()) return;
    setState('sending');
    try {
      await submitWish({ name: name.trim(), message: message.trim() });
      setName('');
      setMessage('');
      setState('done');
      setComposing(false);
    } catch {
      setState('error');
    }
  }

  const line = `1px solid ${hairline(p.color)}`;
  const field: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    marginBottom: 8,
    // Cùng lý do với form RSVP: nhãn đi theo font của mẫu, còn chữ khách vừa
    // gõ thì phải soát lại được, nên khoá về font hệ thống.
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fontSize: p.fontSize * 0.85,
    color: p.color,
    // Nền là chính màu chữ pha rất loãng, KHÔNG phải trắng cố định: mẫu nền tối
    // thì màu chữ cũng sáng, và một ô trắng đục ở đó là chữ trắng trên nền
    // trắng. Pha theo màu chữ thì ô nhập luôn tách khỏi nền mà chữ vẫn đọc được.
    background: `color-mix(in srgb, ${p.color} 7%, transparent)`,
    border: line,
    borderRadius: 8,
  };

  return (
    <NodeShell
      id={node.id}
      p={p}
      innerStyle={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.color, overflowY: 'auto' }}
    >
      {/* Tiêu đề bỏ trống được: mẫu nào đã có dòng tiêu đề riêng bằng font thư
          pháp ở ngay trên thì khối này không nhắc lại — và khi đó, sổ chưa có
          ai viết thì cả cụm đầu khối biến mất, không để lại một gạch ngang lửng
          lơ trên đầu ô nhập. */}
      {(p.titleText || list.length > 0) && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          {p.titleText && <div style={{ fontWeight: 700, fontSize: p.fontSize * 1.15 }}>{p.titleText}</div>}
          {list.length > 0 && (
            <div style={{ fontSize: p.fontSize * 0.72, opacity: 0.6, marginTop: 2 }}>
              {list.length} lời chúc
            </div>
          )}
          <div style={{ width: 36, height: 1, background: p.accentColor, opacity: 0.5, margin: '8px auto 0' }} />
        </div>
      )}

      {p.enableForm && (
        <div style={{ marginBottom: 10 }}>
          {composing ? (
            <div>
              <input
                ref={nameRef}
                style={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={p.nameLabel}
                aria-label={p.nameLabel}
                maxLength={120}
              />
              <textarea
                style={{ ...field, minHeight: 62, resize: 'vertical' }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={p.messageLabel}
                aria-label={p.messageLabel}
                maxLength={2000}
              />
              {state === 'error' && (
                <div style={{ fontSize: p.fontSize * 0.75, color: '#c0392b', marginBottom: 6 }}>
                  Gửi không được, bạn thử lại giúp nhé.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setComposing(false)} style={ghostButton(p, line)}>
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={state === 'sending' || !name.trim() || !message.trim()}
                  style={{
                    ...solidButton(p),
                    flex: 2,
                    opacity: state === 'sending' || !name.trim() || !message.trim() ? 0.55 : 1,
                  }}
                >
                  {state === 'sending' ? 'Đang gửi…' : p.submitText}
                </button>
              </div>
            </div>
          ) : state === 'done' ? (
            // Lời cảm ơn đứng đúng chỗ cái nút vừa đứng, và bấm được để viết
            // tiếp: một nhà thường gửi thêm lời chúc cho người vắng mặt.
            <button
              type="button"
              onClick={() => { setState('idle'); setComposing(true); }}
              style={ghostButton(p, line)}
            >
              {p.successText}
            </button>
          ) : (
            <button type="button" onClick={() => setComposing(true)} style={solidButton(p)}>
              {p.composeText}
            </button>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        // Ô nhập đang mở đã là lời mời viết rồi; thêm một dòng "chưa có ai
        // viết" ngay dưới nữa thì thành hai câu nói cùng một việc.
        composing ? null : (
          <div style={{ textAlign: 'center', opacity: 0.6, padding: '12px 0' }}>{p.emptyText}</div>
        )
      ) : (
        shown.map((w) => (
          <div
            key={w.id}
            style={{
              display: 'flex',
              gap: 8,
              padding: p.cardColor ? 10 : '8px 0',
              marginBottom: p.cardColor ? 8 : 0,
              background: p.cardColor || undefined,
              borderRadius: p.cardColor ? 10 : 0,
              borderBottom: p.cardColor ? undefined : line,
            }}
          >
            {p.showAvatar && (
              <div
                aria-hidden
                style={{
                  flex: '0 0 auto',
                  width: p.fontSize * 1.9,
                  height: p.fontSize * 1.9,
                  borderRadius: '50%',
                  background: p.accentColor,
                  color: p.buttonTextColor,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: p.fontSize * 0.9,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {initial(w.name)}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{w.name}</span>
                {p.showTime && (
                  <span style={{ fontSize: p.fontSize * 0.7, opacity: 0.55 }}>{timeAgo(w.createdAt)}</span>
                )}
              </div>
              {/* `break-word` chứ không để mặc định: một khách dán vào chuỗi
                  emoji hay link dài là đủ nong khối rộng ra khỏi khung thiệp. */}
              <div style={{ opacity: 0.85, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{w.message}</div>
            </div>
          </div>
        ))
      )}

      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{ ...ghostButton(p, line), marginTop: 10 }}
        >
          {p.moreText} ({rest})
        </button>
      )}
    </NodeShell>
  );
}

/** Ba lời chúc giả, chỉ hiện trong editor để canh bố cục */
const PREVIEW_WISHES: Wish[] = [
  { id: 'preview-1', name: 'Minh Anh', message: 'Chúc hai bạn trăm năm hạnh phúc, sớm sinh quý tử nhé!', createdAt: '' },
  { id: 'preview-2', name: 'Gia đình bác Hải', message: 'Mừng hai cháu. Chúc các cháu luôn yêu thương nhau.', createdAt: '' },
  { id: 'preview-3', name: 'Tổ 4 công ty', message: 'Trăm năm hạnh phúc!', createdAt: '' },
];

/** Chữ cái đầu của TIẾNG CUỐI: người Việt gọi nhau bằng tên, không phải bằng họ */
function initial(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? '?').charAt(0).toUpperCase();
}

/**
 * "vừa xong" / "12 phút trước" / "3 ngày trước" / "12/09".
 *
 * Quá một tuần thì quay về ngày tháng: "23 ngày trước" bắt người đọc tự trừ
 * lịch, mà ở một cuốn lưu bút thì mốc thời gian chính xác cũng chẳng để làm gì.
 */
function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return 'vừa xong';

  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;

  const day = Math.floor(hour / 24);
  if (day === 1) return 'hôm qua';
  if (day < 7) return `${day} ngày trước`;

  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Đường kẻ ăn theo màu chữ của mẫu.
 *
 * Kẻ đen mờ cố định thì biến mất trên nền tối, mà mẫu nào cũng có quyền dùng
 * nền tối — lấy chính màu chữ pha loãng thì đường kẻ luôn tách khỏi nền.
 */
function hairline(color: string): string {
  return `color-mix(in srgb, ${color} 22%, transparent)`;
}

function solidButton(p: PropsOf<'Wishes'>): CSSProperties {
  return {
    width: '100%',
    padding: '9px 12px',
    fontFamily: 'inherit',
    fontSize: p.fontSize * 0.85,
    fontWeight: 600,
    color: p.buttonTextColor,
    background: p.accentColor,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  };
}

function ghostButton(p: PropsOf<'Wishes'>, line: string): CSSProperties {
  return {
    flex: 1,
    width: '100%',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontSize: p.fontSize * 0.8,
    color: p.color,
    background: 'transparent',
    border: line,
    borderRadius: 8,
    cursor: 'pointer',
  };
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
  const all = p.accounts.length > 0 ? p.accounts : (data?.accounts ?? []);
  // `accountIndex` trỏ vào một tài khoản cụ thể; ngoài khoảng thì coi như chưa
  // có, chứ không âm thầm rơi về tài khoản của người khác.
  const accounts = p.accountIndex == null ? all : all.slice(p.accountIndex, p.accountIndex + 1);

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
          aria-label={p.label || p.modalTitle}
          style={{
            all: 'unset',
            // Nền, viền, bo góc là của NodeShell — nút chỉ lo chữ và vùng bấm,
            // nên cùng một node vừa làm được icon vừa làm được nút chữ.
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            fontFamily: p.fontFamily,
            fontSize: p.fontSize,
            color: p.color,
            lineHeight: 1.1,
            textAlign: 'center',
            backgroundImage: !p.label && icon ? `url("${icon}")` : undefined,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }}
        >
          {p.label}
        </button>
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
          {/*
            Hộp thoại này tồn tại để khách QUÉT một mã QR, nên bề ngang của nó
            là bề ngang của mã. 420 thay vì 360, và `min(...)` ăn theo cạnh ngắn
            của màn hình để trên điện thoại nằm ngang mã không bị tràn ra ngoài
            rồi phải cuộn mới thấy hết.
          */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              maxWidth: 'min(420px, 92vmin)',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>{p.modalTitle}</div>
            {/*
              Chủ thiệp có thể bật nút trước, điền số tài khoản sau. Nói thẳng
              là chưa có còn hơn mở ra một hộp trắng trơn, và hơn hẳn việc giấu
              luôn cái nút — khách vừa bấm xong mà nút biến mất thì tưởng hỏng.
            */}
            {accounts.length === 0 && (
              <div style={{ textAlign: 'center', fontSize: 14, color: '#666', marginBottom: 20 }}>
                Thông tin chuyển khoản sẽ được cập nhật.
              </div>
            )}
            {accounts.map((acc) => (
              <div key={acc.id} style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{acc.displayName}</div>
                {/*
                  Trải hết bề ngang thay vì đóng cứng 200px. Ảnh QR chủ thiệp
                  tải lên thường là tấm thẻ VietQR đầy đủ — có logo ngân hàng,
                  tên và số tài khoản in quanh — nên ô vuông quét được chỉ chiếm
                  quãng giữa. Khung 200px làm phần quét được co xuống còn hơn
                  100px, tới ngưỡng máy phải rà sát mới bắt.

                  `height: auto` để thẻ VietQR (cao hơn rộng) không bị bóp méo.
                  Xin ảnh theo bề ngang CSS (400) — `imageUrl` tự nhân DPR rồi
                  làm tròn lên bậc, nên màn 2x nhận ảnh 800px.
                */}
                {acc.qrCode && (
                  <img
                    src={imageUrl(assetBase, acc.qrCode, 400, dpr, { format: 'png' })}
                    alt={`QR ${acc.displayName}`}
                    style={{
                      // `auto` + hai cái max, KHÔNG phải `width: 100%`: khi
                      // chiều cao bị chặn thì ô ảnh vẫn giữ nguyên bề ngang và
                      // `objectFit: contain` kê hai dải trắng hai bên, nên mã
                      // thu nhỏ mà chỗ trống thì vẫn chiếm. Để auto thì chính ô
                      // ảnh co lại vừa khít tấm hình.
                      display: 'block',
                      margin: '0 auto',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: '70vh',
                    }}
                  />
                )}
                {/*
                  Ba dòng dưới chỉ hiện khi có dữ liệu. Tấm thẻ VietQR đã in sẵn
                  tên và số tài khoản lên ảnh, nên nhiều người bỏ trống mấy ô
                  này — mà nút chép rỗng thì thành một viên thuốc xám trống trơn
                  ngay dưới mã, bấm vào chép được đúng chuỗi rỗng.
                */}
                {acc.bank && <div style={{ fontSize: 13, marginTop: 8 }}>{acc.bank}</div>}
                {acc.name && <div style={{ fontSize: 13 }}>{acc.name}</div>}
                {acc.accountNumber && (
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
                )}
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
