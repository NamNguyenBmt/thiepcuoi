-- Lược đồ Postgres. Chạy lại được nhiều lần (idempotent).

create table if not exists users (
  id            text primary key,
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  role          text not null default 'user' check (role in ('admin', 'user')),
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- Dọn phiên hết hạn quét theo cột này
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists assets (
  id            text primary key,
  key           text not null unique,
  owner_id      text not null references users(id) on delete cascade,
  mime          text not null,
  width         integer not null,
  height        integer not null,
  bytes         integer not null,
  original_name text not null,
  created_at    timestamptz not null default now()
);
create index if not exists assets_owner_idx on assets (owner_id, created_at desc);

create table if not exists templates (
  id          text primary key,
  slug        text not null unique,
  name        text not null,
  owner_id    text not null references users(id),
  doc_packed  text not null,
  thumbnail   text,
  usage_count integer not null default 0,
  revision    integer not null default 1,
  created_at  timestamptz not null default now()
);

create table if not exists invites (
  id           text primary key,
  slug         text not null unique,
  owner_id     text not null references users(id) on delete cascade,
  -- Cố ý KHÔNG cascade: xoá mẫu khi còn thiệp phải là lỗi, không phải là xoá kèm
  template_id  text not null references templates(id),
  data         jsonb not null,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists invites_owner_idx on invites (owner_id);

-- Slug cũ của thiệp sau khi đổi tên, để link đã gửi cho khách không chết.
-- Tra trực tiếp trong `invites` luôn ưu tiên trước bảng này (xem lib/db.ts),
-- nên một slug từng bị đổi đi rồi được dùng lại cho thiệp khác không xung đột.
-- Nội dung schema.sql đang áp dụng trên database này.
--
-- Có nó thì mỗi lần khởi động chỉ tốn một câu đọc thay vì chạy lại toàn bộ DDL
-- (xem migrate() trong lib/sql.ts). Lưu nguyên văn chứ không lưu hash: đọc ra
-- là biết ngay database đang ở phiên bản nào, khỏi đoán.
create table if not exists schema_state (
  id         smallint primary key check (id = 1),
  ddl        text not null,
  applied_at timestamptz not null default now()
);

create table if not exists invite_slug_redirects (
  old_slug   text primary key,
  invite_id  text not null references invites(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists rsvps (
  id             text primary key,
  invite_id      text not null references invites(id) on delete cascade,
  name           text not null,
  attending      boolean not null,
  attendee_count integer not null default 0,
  guest_side     text check (guest_side in ('groom', 'bride')),
  transportation text check (transportation in ('self', 'pickup')),
  pickup_slot_id text,
  message        text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists rsvps_invite_idx on rsvps (invite_id, created_at desc);

create table if not exists wishes (
  id         text primary key,
  invite_id  text not null references invites(id) on delete cascade,
  name       text not null,
  message    text not null,
  created_at timestamptz not null default now()
);
create index if not exists wishes_invite_idx on wishes (invite_id, created_at desc);

-- Bộ đếm "bắn tim" của khách xem thiệp.
-- Một hàng cho mỗi thiệp thay vì một hàng cho mỗi lượt: con số duy nhất cần
-- hiển thị là tổng, còn lưu từng lượt thì bảng phình ra vô ích và vẫn không
-- nói lên điều gì (khách không đăng nhập, không phân biệt được ai với ai).
create table if not exists reactions (
  invite_id  text primary key references invites(id) on delete cascade,
  hearts     bigint not null default 0,
  updated_at timestamptz not null default now()
);
