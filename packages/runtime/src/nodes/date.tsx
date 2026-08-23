import { useEffect, useMemo, useState } from 'react';
import { resolveTokens } from '@thiepcuoi/schema';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl } from '../image';

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Ngày của Calendar/CountDown được phép là token: "{{events.0.datetime}}".
 *
 * Không có bước này thì lịch và đồng hồ đếm ngược đóng đinh vào ngày cưới của
 * cặp đôi đầu tiên dựng mẫu, trong khi phần chữ ngay bên cạnh lấy từ token và
 * hiện đúng ngày của thiệp — hai con số đá nhau ngay trên cùng một màn hình.
 *
 * Trả về chuỗi rỗng khi không ra được ngày hợp lệ (thiệp chưa nhập ngày, hoặc
 * token gõ sai). Chỗ gọi tự quyết định cách xử sự; không nơi nào được phép đưa
 * `Invalid Date` vào tính toán.
 */
function resolveDate(raw: string, data: unknown, mode: 'editor' | 'render'): string {
  const value = raw.includes('{{') ? resolveTokens(raw, data, mode).trim() : raw;
  return Number.isNaN(Date.parse(value)) ? '' : value;
}

/** Lưới ngày của tháng, đã đệm ô trống đầu tháng theo weekStartsOn */
function monthGrid(monthIso: string, weekStartsOn: 0 | 1): (number | null)[] {
  const d = new Date(monthIso);
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1).getDay();
  const lead = (first - weekStartsOn + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let i = 1; i <= days; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarNode({ node }: NodeProps<'Calendar'>) {
  const { assetBase, dpr, data, mode } = useRuntime();
  const p = node.props;

  // Thiếu ngày thì vẽ tháng hiện tại: lưới trống hoàn toàn nhìn như lỗi render
  const month = resolveDate(p.month, data, mode) || new Date().toISOString();
  const markedDates = useMemo(
    () => p.markedDates.map((d) => resolveDate(d, data, mode)).filter(Boolean),
    [p.markedDates, data, mode],
  );

  const { cells, marked, labels } = useMemo(() => {
    const base = new Date(month);
    const marks = new Set(
      markedDates
        .map((iso) => new Date(iso))
        .filter((d) => d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth())
        .map((d) => d.getDate()),
    );
    const heads = p.weekStartsOn === 1
      ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]!]
      : WEEKDAY_LABELS;
    return { cells: monthGrid(month, p.weekStartsOn), marked: marks, labels: heads };
  }, [month, markedDates, p.weekStartsOn]);

  const marker = p.markerIcon ? imageUrl(assetBase, p.markerIcon, 64, dpr, { format: 'png' }) : null;

  return (
    <NodeShell
      id={node.id}
      p={p}
      innerStyle={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        alignContent: 'center',
        gap: 2,
        fontFamily: p.fontFamily,
        fontSize: p.fontSize,
        color: p.color,
      }}
    >
      {labels.map((w) => (
        <div key={w} style={{ textAlign: 'center', fontWeight: 600, opacity: 0.7, padding: '2px 0' }}>
          {w}
        </div>
      ))}
      {cells.map((day, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            aspectRatio: '1 / 1',
            color: day && marked.has(day) ? '#fff' : undefined,
            fontWeight: day && marked.has(day) ? 700 : undefined,
          }}
        >
          {day && marked.has(day) && (
            marker ? (
              <img
                src={marker}
                alt=""
                aria-hidden
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: '10%',
                  borderRadius: '50%',
                  background: p.themeColor,
                }}
              />
            )
          )}
          <span style={{ position: 'relative' }}>{day ?? ''}</span>
        </div>
      ))}
    </NodeShell>
  );
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function remainingUntil(targetIso: string, now: number): Remaining {
  const diff = new Date(targetIso).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
  };
}

export function CountDownNode({ node }: NodeProps<'CountDown'>) {
  const { data, mode } = useRuntime();
  const p = node.props;
  const targetDate = resolveDate(p.targetDate, data, mode);

  // SSR và client lệch nhau vài giây là chuyện chắc chắn xảy ra: render lần đầu
  // bằng mốc 0 rồi mới chạy đồng hồ trong effect, để không có hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const r = now == null
    ? { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false }
    : remainingUntil(targetDate, now);

  // Chưa có ngày cưới thì không vẽ gì. Đếm ngược rỗng sẽ rơi vào nhánh "đã qua"
  // và thông báo hai người đã về chung một nhà — sai, và sai một cách khó chịu.
  if (!targetDate) return null;

  const items: Array<[number, string]> = [
    [r.days, p.labels.days],
    [r.hours, p.labels.hours],
    [r.minutes, p.labels.minutes],
    [r.seconds, p.labels.seconds],
  ];

  return (
    <NodeShell
      id={node.id}
      p={p}
      innerStyle={{
        display: 'flex',
        flexDirection: p.direction === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: p.spacing,
        fontFamily: p.fontFamily,
        fontSize: p.fontSize,
        color: p.color,
      }}
    >
      {r.expired ? (
        <span style={{ fontSize: p.fontSize * 1.2 }}>{p.expiredText}</span>
      ) : (
        items.map(([value, label]) => (
          <div
            key={label}
            style={{
              display: 'grid',
              placeItems: 'center',
              minWidth: p.fontSize * 3.2,
              padding: '8px 4px',
              borderRadius: 8,
              background: p.themeColor,
            }}
          >
            <span
              suppressHydrationWarning
              style={{ fontSize: p.fontSize * 1.7, fontWeight: 700, lineHeight: 1.1 }}
            >
              {value}
            </span>
            <span style={{ fontSize: p.fontSize * 0.8, opacity: 0.85 }}>{label}</span>
          </div>
        ))
      )}
    </NodeShell>
  );
}
