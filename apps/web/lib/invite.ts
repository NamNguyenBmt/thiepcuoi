/**
 * Dựng và kiểm `InviteData`.
 *
 * Dữ liệu này đến thẳng từ form của người dùng rồi được nhét vào renderer, nên
 * phải cắt độ dài và ép kiểu ở đây — không tin `as InviteData`.
 */

import type { BankAccount, EventInfo, InviteData, PartyInfo } from '@thiepcuoi/schema';

const MAX_TEXT = 200;
const MAX_MESSAGE = 2000;
const MAX_EVENTS = 6;
const MAX_ACCOUNTS = 4;

const str = (v: unknown, max = MAX_TEXT): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function party(v: unknown): PartyInfo {
  const p = (v ?? {}) as Record<string, unknown>;
  return {
    fullName: str(p.fullName),
    shortName: str(p.shortName, 60),
    father: str(p.father),
    mother: str(p.mother),
    address: str(p.address),
  };
}

function event(v: unknown, index: number): EventInfo {
  const e = (v ?? {}) as Record<string, unknown>;
  const datetime = str(e.datetime, 40);
  return {
    id: str(e.id, 40) || `ev-${index + 1}`,
    title: str(e.title),
    // Ngày giờ không đọc được thì bỏ trống còn hơn nhét chuỗi rác cho CountDown
    datetime: Number.isNaN(Date.parse(datetime)) ? '' : datetime,
    lunarText: str(e.lunarText),
    venue: str(e.venue),
    address: str(e.address),
    lat: num(e.lat),
    lng: num(e.lng),
  };
}

function account(v: unknown, index: number): BankAccount {
  const a = (v ?? {}) as Record<string, unknown>;
  return {
    id: str(a.id, 40) || `acc-${index + 1}`,
    displayName: str(a.displayName, 60),
    name: str(a.name),
    accountNumber: str(a.accountNumber, 40),
    bank: str(a.bank),
    qrCode: str(a.qrCode, 300) || null,
  };
}

export function parseInviteData(v: unknown): InviteData {
  const d = (v ?? {}) as Record<string, unknown>;

  const photos: Record<string, string> = {};
  if (d.photos && typeof d.photos === 'object') {
    for (const [slot, key] of Object.entries(d.photos as Record<string, unknown>)) {
      if (typeof key === 'string' && key) photos[str(slot, 40)] = str(key, 300);
    }
  }

  return {
    groom: party(d.groom),
    bride: party(d.bride),
    events: Array.isArray(d.events) ? d.events.slice(0, MAX_EVENTS).map(event) : [],
    photos,
    accounts: Array.isArray(d.accounts) ? d.accounts.slice(0, MAX_ACCOUNTS).map(account) : [],
    message: str(d.message, MAX_MESSAGE),
  };
}

/** Thiệp mới: một sự kiện trống để form có sẵn khung mà điền */
export function emptyInviteData(): InviteData {
  return parseInviteData({
    events: [{ id: 'ev-1', title: 'Lễ thành hôn' }],
  });
}
