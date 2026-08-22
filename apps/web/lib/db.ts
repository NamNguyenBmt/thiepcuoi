/**
 * Lớp truy cập dữ liệu.
 *
 * Chữ ký các hàm giữ nguyên như hồi còn ghi file JSON — đó chính là mục đích của
 * việc bọc mọi truy cập sau một interface hẹp ngay từ đầu: đổi kho lưu trữ mà
 * API, trang thiệp và editor không phải sửa dòng nào.
 *
 * Quy ước: cột trong Postgres là snake_case, kiểu trả về là camelCase, và
 * timestamptz đổi sang chuỗi ISO ngay tại đây.
 */

import type { InviteData } from '@thiepcuoi/schema';
import { getSql, iso, isoOrNull } from './sql';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  /** scrypt: "salt:hash" dạng hex — không lưu mật khẩu gốc ở bất kỳ đâu */
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface SessionRow {
  /** sha256 của token trong cookie, không phải token — DB rò rỉ thì không ai đăng nhập được */
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface AssetRow {
  id: string;
  /** Khoá dùng trong TemplateDoc: "uploads/<id>.<ext>" */
  key: string;
  ownerId: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string;
  createdAt: string;
}

export interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  /** TemplateDoc đã nén bằng packDoc */
  docPacked: string;
  thumbnail: string | null;
  usageCount: number;
  /** Tăng sau mỗi lần lưu — dùng để phát hiện hai tab ghi đè nhau */
  revision: number;
}

export interface InviteRow {
  id: string;
  slug: string;
  ownerId: string;
  templateId: string;
  data: InviteData;
  publishedAt: string | null;
}

export interface RsvpRow {
  id: string;
  inviteId: string;
  name: string;
  attending: boolean;
  attendeeCount: number;
  guestSide: 'groom' | 'bride' | null;
  transportation: 'self' | 'pickup' | null;
  pickupSlotId: string | null;
  message: string;
  createdAt: string;
}

export interface WishRow {
  id: string;
  inviteId: string;
  name: string;
  message: string;
  createdAt: string;
}

/** Chỉ dùng cho seed và script chuyển dữ liệu */
export interface Database {
  users: UserRow[];
  sessions: SessionRow[];
  assets: AssetRow[];
  templates: TemplateRow[];
  invites: InviteRow[];
  rsvps: RsvpRow[];
  wishes: WishRow[];
}

// ─────────────────────────── Ánh xạ hàng ───────────────────────────

type Row = Record<string, any>;

const toUser = (r: Row): UserRow => ({
  id: r.id,
  email: r.email,
  name: r.name,
  passwordHash: r.password_hash,
  role: r.role,
  createdAt: iso(r.created_at),
});

const toSession = (r: Row): SessionRow => ({
  tokenHash: r.token_hash,
  userId: r.user_id,
  expiresAt: iso(r.expires_at),
  createdAt: iso(r.created_at),
});

const toAsset = (r: Row): AssetRow => ({
  id: r.id,
  key: r.key,
  ownerId: r.owner_id,
  mime: r.mime,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  originalName: r.original_name,
  createdAt: iso(r.created_at),
});

const toTemplate = (r: Row): TemplateRow => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  ownerId: r.owner_id,
  docPacked: r.doc_packed,
  thumbnail: r.thumbnail,
  usageCount: r.usage_count,
  revision: r.revision,
});

const toInvite = (r: Row): InviteRow => ({
  id: r.id,
  slug: r.slug,
  ownerId: r.owner_id,
  templateId: r.template_id,
  // jsonb về từ driver đã là object; vẫn phòng trường hợp trả về chuỗi
  data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
  publishedAt: isoOrNull(r.published_at),
});

const toRsvp = (r: Row): RsvpRow => ({
  id: r.id,
  inviteId: r.invite_id,
  name: r.name,
  attending: r.attending,
  attendeeCount: r.attendee_count,
  guestSide: r.guest_side,
  transportation: r.transportation,
  pickupSlotId: r.pickup_slot_id,
  message: r.message,
  createdAt: iso(r.created_at),
});

const toWish = (r: Row): WishRow => ({
  id: r.id,
  inviteId: r.invite_id,
  name: r.name,
  message: r.message,
  createdAt: iso(r.created_at),
});

// ─────────────────────────── Đọc ───────────────────────────

export async function listTemplates(): Promise<TemplateRow[]> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from templates order by created_at');
  return rows.map(toTemplate);
}

export async function getTemplateBySlug(slug: string): Promise<TemplateRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from templates where slug = $1', [slug]);
  return rows[0] ? toTemplate(rows[0]) : null;
}

export async function getTemplateById(id: string): Promise<TemplateRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from templates where id = $1', [id]);
  return rows[0] ? toTemplate(rows[0]) : null;
}

export async function getInviteBySlug(slug: string): Promise<InviteRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from invites where slug = $1', [slug]);
  return rows[0] ? toInvite(rows[0]) : null;
}

export async function getInviteById(id: string): Promise<InviteRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from invites where id = $1', [id]);
  return rows[0] ? toInvite(rows[0]) : null;
}

export async function listInvites(): Promise<InviteRow[]> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from invites order by created_at');
  return rows.map(toInvite);
}

export async function listInvitesByOwner(ownerId: string): Promise<InviteRow[]> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from invites where owner_id = $1 order by created_at', [ownerId]);
  return rows.map(toInvite);
}

export async function listWishes(inviteId: string): Promise<WishRow[]> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from wishes where invite_id = $1 order by created_at desc', [
    inviteId,
  ]);
  return rows.map(toWish);
}

export async function listRsvps(inviteId: string): Promise<RsvpRow[]> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from rsvps where invite_id = $1 order by created_at desc', [
    inviteId,
  ]);
  return rows.map(toRsvp);
}

/** Không truyền ownerId = lấy tất cả (chỉ admin mới được gọi kiểu đó) */
export async function listAssets(ownerId?: string): Promise<AssetRow[]> {
  const sql = await getSql();
  const { rows } = ownerId
    ? await sql.query('select * from assets where owner_id = $1 order by created_at desc', [ownerId])
    : await sql.query('select * from assets order by created_at desc');
  return rows.map(toAsset);
}

export async function getAssetByKey(key: string): Promise<AssetRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from assets where key = $1', [key]);
  return rows[0] ? toAsset(rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from users where email = $1', [email.trim().toLowerCase()]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from users where id = $1', [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getSessionByTokenHash(tokenHash: string): Promise<SessionRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query('select * from sessions where token_hash = $1', [tokenHash]);
  return rows[0] ? toSession(rows[0]) : null;
}

export async function allSlugs(kind: 'templates' | 'invites'): Promise<string[]> {
  const sql = await getSql();
  // Tên bảng là union hai chuỗi cố định, không đến từ người dùng, nên nội suy an toàn
  const { rows } = await sql.query<{ slug: string }>(`select slug from ${kind}`);
  return rows.map((r) => r.slug);
}

// ─────────────────────────── Ghi ───────────────────────────

export async function createSession(row: SessionRow): Promise<SessionRow> {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    // Dọn phiên hết hạn ngay lúc tạo phiên mới: không cần cron cho một bảng nhỏ
    await tx.query('delete from sessions where expires_at <= now()');
    await tx.query(
      `insert into sessions (token_hash, user_id, expires_at, created_at)
       values ($1, $2, $3, $4)`,
      [row.tokenHash, row.userId, row.expiresAt, row.createdAt],
    );
  });
  return row;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  const sql = await getSql();
  await sql.query('delete from sessions where token_hash = $1', [tokenHash]);
}

export async function createAsset(row: Omit<AssetRow, 'createdAt'>): Promise<AssetRow> {
  const sql = await getSql();
  const { rows } = await sql.query(
    `insert into assets (id, key, owner_id, mime, width, height, bytes, original_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [row.id, row.key, row.ownerId, row.mime, row.width, row.height, row.bytes, row.originalName],
  );
  return toAsset(rows[0]!);
}

export async function createTemplate(row: Omit<TemplateRow, 'revision'>): Promise<TemplateRow> {
  const sql = await getSql();
  const { rows } = await sql.query(
    `insert into templates (id, slug, name, owner_id, doc_packed, thumbnail, usage_count)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [row.id, row.slug, row.name, row.ownerId, row.docPacked, row.thumbnail, row.usageCount],
  );
  return toTemplate(rows[0]!);
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<TemplateRow, 'name' | 'docPacked' | 'thumbnail'>>,
): Promise<TemplateRow | null> {
  const sql = await getSql();
  // coalesce: chỉ đổi cột nào được truyền, khỏi phải dựng câu SQL động
  const { rows } = await sql.query(
    `update templates
        set name       = coalesce($2, name),
            doc_packed = coalesce($3, doc_packed),
            thumbnail  = coalesce($4, thumbnail),
            revision   = revision + 1
      where id = $1
      returning *`,
    [id, patch.name ?? null, patch.docPacked ?? null, patch.thumbnail ?? null],
  );
  return rows[0] ? toTemplate(rows[0]) : null;
}

/** Trả về false nếu còn thiệp đang dùng mẫu — xoá sẽ làm chết trang thiệp đó */
export async function deleteTemplate(id: string): Promise<boolean> {
  const sql = await getSql();
  return sql.transaction(async (tx) => {
    const { rows } = await tx.query<{ count: string }>(
      'select count(*)::text as count from invites where template_id = $1',
      [id],
    );
    if (rows[0]?.count !== '0') return false;
    await tx.query('delete from templates where id = $1', [id]);
    return true;
  });
}

export async function createInvite(row: InviteRow): Promise<InviteRow> {
  const sql = await getSql();
  return sql.transaction(async (tx) => {
    const { rows } = await tx.query(
      `insert into invites (id, slug, owner_id, template_id, data, published_at)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [row.id, row.slug, row.ownerId, row.templateId, JSON.stringify(row.data), row.publishedAt],
    );
    await tx.query('update templates set usage_count = usage_count + 1 where id = $1', [row.templateId]);
    return toInvite(rows[0]!);
  });
}

export async function updateInvite(
  id: string,
  patch: Partial<Pick<InviteRow, 'slug' | 'data' | 'publishedAt'>>,
): Promise<InviteRow | null> {
  const sql = await getSql();
  const { rows } = await sql.query(
    `update invites
        set slug         = coalesce($2, slug),
            data         = coalesce($3::jsonb, data),
            published_at = case when $4 then $5::timestamptz else published_at end
      where id = $1
      returning *`,
    [
      id,
      patch.slug ?? null,
      patch.data ? JSON.stringify(patch.data) : null,
      // publishedAt phải phân biệt "không đụng tới" với "đặt thành null" (gỡ phát
      // hành), nên cần cờ riêng chứ coalesce không diễn tả được
      'publishedAt' in patch,
      patch.publishedAt ?? null,
    ],
  );
  return rows[0] ? toInvite(rows[0]) : null;
}

export async function createRsvp(row: Omit<RsvpRow, 'id' | 'createdAt'>): Promise<RsvpRow> {
  const sql = await getSql();
  return sql.transaction(async (tx) => {
    const { rows } = await tx.query(
      `insert into rsvps (id, invite_id, name, attending, attendee_count, guest_side, transportation, pickup_slot_id, message)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        crypto.randomUUID(),
        row.inviteId,
        row.name,
        row.attending,
        row.attendeeCount,
        row.guestSide,
        row.transportation,
        row.pickupSlotId,
        row.message,
      ],
    );
    const saved = toRsvp(rows[0]!);

    // Lời chúc kèm trong form RSVP cũng vào sổ lưu bút, khách không phải gõ 2 lần
    if (saved.message.trim()) {
      await tx.query(
        `insert into wishes (id, invite_id, name, message, created_at)
         values ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), saved.inviteId, saved.name, saved.message.trim(), saved.createdAt],
      );
    }
    return saved;
  });
}

export async function createWish(row: Omit<WishRow, 'id' | 'createdAt'>): Promise<WishRow> {
  const sql = await getSql();
  const { rows } = await sql.query(
    `insert into wishes (id, invite_id, name, message)
     values ($1, $2, $3, $4)
     returning *`,
    [crypto.randomUUID(), row.inviteId, row.name, row.message],
  );
  return toWish(rows[0]!);
}

// ─────────────────────────── Bắn tim ───────────────────────────

/**
 * Cộng thêm lượt tim và trả về tổng mới.
 *
 * Cộng ngay trong câu lệnh (`hearts + $2`) chứ không đọc-rồi-ghi từ Node: hai
 * khách bấm cùng lúc thì cách kia mất một lượt, còn cách này thì không.
 */
export async function addHearts(inviteId: string, amount: number): Promise<number> {
  const sql = await getSql();
  const { rows } = await sql.query<{ hearts: string }>(
    `insert into reactions (invite_id, hearts) values ($1, $2)
     on conflict (invite_id) do update
       set hearts = reactions.hearts + $2, updated_at = now()
     returning hearts::text as hearts`,
    [inviteId, amount],
  );
  return Number(rows[0]?.hearts ?? 0);
}

export async function getHearts(inviteId: string): Promise<number> {
  const sql = await getSql();
  const { rows } = await sql.query<{ hearts: string }>(
    'select hearts::text as hearts from reactions where invite_id = $1',
    [inviteId],
  );
  return Number(rows[0]?.hearts ?? 0);
}
