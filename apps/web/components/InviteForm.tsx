'use client';

/**
 * Form nội dung thiệp.
 *
 * State là một bản sao `InviteData` trong bộ nhớ; mọi ô đều điều khiển bằng một
 * hàm `patch` duy nhất, nên thêm trường mới chỉ là thêm một `<Field>`.
 *
 * Các slot ảnh (`data.photos`) khớp với `PhotoProps.slot` trong mẫu — điền ở đây
 * là ảnh thay vào đúng khung mà người thiết kế đã chừa.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { InviteData } from '@thiepcuoi/schema';
import { ImageInput } from './ImageInput';

export interface InviteFormProps {
  inviteId: string;
  initialSlug: string;
  initialPublished: boolean;
  initialData: InviteData;
  /** Slot ảnh mà mẫu đang dùng — lấy từ chính TemplateDoc */
  photoSlots: string[];
}

export function InviteForm({ inviteId, initialSlug, initialPublished, initialData, photoSlots }: InviteFormProps) {
  const router = useRouter();
  const [data, setData] = useState<InviteData>(initialData);
  const [slug, setSlug] = useState(initialSlug);
  const [published, setPublished] = useState(initialPublished);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (fn: (draft: InviteData) => void) =>
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus('Đang lưu…');
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data, slug, published }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(body?.error ?? `Lỗi ${res.status}`);
        return;
      }
      setSlug(body.slug);
      setStatus(`Đã lưu · ${body.publishedAt ? 'đã phát hành' : 'đang là nháp'}`);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Section title="Đường dẫn & phát hành">
        <Field label="Slug (đường dẫn /thiep/…)">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} style={input} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Phát hành (bỏ chọn = nháp, người ngoài mở link sẽ thấy 404)
        </label>
        {published && (
          <a href={`/thiep/${slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Mở thiệp trong tab mới →
          </a>
        )}
      </Section>

      <Section title="Chú rể">
        <PartyFields
          value={data.groom}
          onChange={(field, v) => patch((d) => void (d.groom[field] = v))}
        />
      </Section>

      <Section title="Cô dâu">
        <PartyFields
          value={data.bride}
          onChange={(field, v) => patch((d) => void (d.bride[field] = v))}
        />
      </Section>

      <Section title="Sự kiện">
        {data.events.map((ev, i) => (
          <div key={ev.id} style={{ borderTop: i ? '1px solid #eef0f2' : 'none', paddingTop: i ? 12 : 0 }}>
            <Field label="Tên sự kiện">
              <input
                value={ev.title}
                onChange={(e) => patch((d) => void (d.events[i]!.title = e.target.value))}
                style={input}
              />
            </Field>
            <Field label="Thời gian">
              <input
                type="datetime-local"
                value={toLocalInput(ev.datetime)}
                onChange={(e) => patch((d) => void (d.events[i]!.datetime = fromLocalInput(e.target.value)))}
                style={input}
              />
            </Field>
            <Field label="Ngày âm lịch (chữ)">
              <input
                value={ev.lunarText}
                onChange={(e) => patch((d) => void (d.events[i]!.lunarText = e.target.value))}
                style={input}
              />
            </Field>
            <Field label="Địa điểm">
              <input
                value={ev.venue}
                onChange={(e) => patch((d) => void (d.events[i]!.venue = e.target.value))}
                style={input}
              />
            </Field>
            <Field label="Địa chỉ">
              <input
                value={ev.address}
                onChange={(e) => patch((d) => void (d.events[i]!.address = e.target.value))}
                style={input}
              />
            </Field>
            {data.events.length > 1 && (
              <button
                type="button"
                onClick={() => patch((d) => void d.events.splice(i, 1))}
                style={{ ...btn, marginBottom: 12 }}
              >
                Xoá sự kiện này
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            patch((d) =>
              void d.events.push({
                id: `ev-${Date.now()}`,
                title: '',
                datetime: '',
                lunarText: '',
                venue: '',
                address: '',
                lat: null,
                lng: null,
              }),
            )
          }
          style={btn}
        >
          + Thêm sự kiện
        </button>
      </Section>

      {photoSlots.length > 0 && (
        <Section title="Ảnh">
          {photoSlots.map((slot) => (
            <ImageInput
              key={slot}
              label={`Slot "${slot}"`}
              value={data.photos[slot] ?? ''}
              onChange={(key) =>
                patch((d) => {
                  if (key) d.photos[slot] = key;
                  else delete d.photos[slot];
                })
              }
            />
          ))}
        </Section>
      )}

      <Section title="Mừng cưới">
        {/*
          Nút "Gửi quà" trên thiệp mở tài khoản theo VỊ TRÍ trong danh sách này,
          không theo tên hiển thị — mẫu không có cách nào biết "Cô dâu" là ai
          nếu người nhập gõ khác đi. Nói rõ ở đây, vì xếp nhầm thứ tự thì khách
          bấm nút bên cô dâu lại ra tài khoản chú rể, mà nhìn thiệp không ai
          phát hiện ra.
        */}
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Thứ tự quan trọng: <strong>tài khoản đầu tiên là chú rể</strong>, thứ hai là cô dâu.
          Hai nút “Gửi quà” trên thiệp mở đúng theo thứ tự này.
        </p>
        {data.accounts.map((acc, i) => (
          <div key={acc.id} style={{ borderTop: i ? '1px solid #eef0f2' : 'none', paddingTop: i ? 12 : 0 }}>
            <Field label="Hiển thị là">
              <input
                value={acc.displayName}
                onChange={(e) => patch((d) => void (d.accounts[i]!.displayName = e.target.value))}
                placeholder="Chú rể / Cô dâu"
                style={input}
              />
            </Field>
            <Field label="Chủ tài khoản">
              <input
                value={acc.name}
                onChange={(e) => patch((d) => void (d.accounts[i]!.name = e.target.value))}
                style={input}
              />
            </Field>
            <Field label="Số tài khoản">
              <input
                value={acc.accountNumber}
                onChange={(e) => patch((d) => void (d.accounts[i]!.accountNumber = e.target.value))}
                style={input}
              />
            </Field>
            <Field label="Ngân hàng">
              <input
                value={acc.bank}
                onChange={(e) => patch((d) => void (d.accounts[i]!.bank = e.target.value))}
                style={input}
              />
            </Field>
            <ImageInput
              label="Ảnh QR"
              value={acc.qrCode ?? ''}
              onChange={(key) => patch((d) => void (d.accounts[i]!.qrCode = key || null))}
            />
            <button
              type="button"
              onClick={() => patch((d) => void d.accounts.splice(i, 1))}
              style={{ ...btn, marginBottom: 12 }}
            >
              Xoá tài khoản này
            </button>
          </div>
        ))}
        {data.accounts.length < 4 && (
          <button
            type="button"
            onClick={() =>
              patch((d) =>
                void d.accounts.push({
                  id: `acc-${Date.now()}`,
                  displayName: '',
                  name: '',
                  accountNumber: '',
                  bank: '',
                  qrCode: null,
                }),
              )
            }
            style={btn}
          >
            + Thêm tài khoản
          </button>
        )}
      </Section>

      <Section title="Lời nhắn">
        <textarea
          value={data.message}
          onChange={(e) => patch((d) => void (d.message = e.target.value))}
          rows={3}
          style={{ ...input, resize: 'vertical' }}
        />
      </Section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', bottom: 0, padding: '12px 0', background: '#eceff1' }}>
        <button type="submit" disabled={busy} style={primary}>
          {busy ? 'Đang lưu…' : 'Lưu thiệp'}
        </button>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{status}</span>
      </div>
    </form>
  );
}

type PartyField = 'fullName' | 'shortName' | 'birthday' | 'father' | 'mother' | 'address';

function PartyFields({
  value,
  onChange,
}: {
  value: InviteData['groom'];
  onChange: (field: PartyField, v: string) => void;
}) {
  const fields: Array<[PartyField, string]> = [
    ['fullName', 'Họ tên đầy đủ'],
    ['shortName', 'Tên gọi (hiện trên bìa)'],
    ['birthday', 'Ngày sinh'],
    ['father', 'Tên bố'],
    ['mother', 'Tên mẹ'],
    ['address', 'Địa chỉ'],
  ];
  return (
    <>
      {fields.map(([key, label]) => (
        <Field key={key} label={label}>
          <input value={value[key]} onChange={(e) => onChange(key, e.target.value)} style={input} />
        </Field>
      ))}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', margin: '0 0 12px' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

/** ISO ↔ giá trị của <input type="datetime-local"> (giờ địa phương, không có Z) */
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const input = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #d8dbe0',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
} as const;

const btn = {
  padding: '5px 10px',
  border: '1px solid #d8dbe0',
  borderRadius: 5,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
} as const;

const primary = {
  padding: '9px 18px',
  border: 'none',
  borderRadius: 6,
  background: '#7a2c2c',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;
