/**
 * Gắn nhạc nền cho một thiệp mà không đụng tới mẫu chung.
 *
 * `TemplateDoc` là thiết kế dùng lại cho nhiều cặp đôi, còn bài hát thì thuộc
 * về đúng một đám cưới. Đặt nhạc thẳng vào mẫu dựng sẵn là thiệp của người lạ
 * cũng kêu bài đó — nên khi mẫu không phải của chủ thiệp, ở đây nhân bản trước
 * rồi mới sửa, và trỏ thiệp sang bản sao.
 *
 * Tách khỏi `scripts/gan-nhac.mts` để test được: bước quyết định (nhân bản hay
 * không) và bước chuyển mẫu là chỗ dễ sai, mà dựng cả một CLI để thử thì không
 * đáng.
 */

import { packDoc, unpackDoc } from '@thiepcuoi/schema';
import type { AudioConfig } from '@thiepcuoi/schema';
import {
  allSlugs, createAsset, createTemplate, getAssetByKey, getInviteBySlug,
  getTemplateById, templateBuiltinHash, updateInvite, updateTemplate,
} from './db';
import type { InviteRow, TemplateRow } from './db';
import { uniqueSlug } from './slug';
import { storeUpload } from './storage';
import type { StoredAsset } from './storage';

export interface AttachAudioInput {
  /** Slug công khai của thiệp, ví dụ `nam-thuy-2` */
  inviteSlug: string;
  /** Nội dung file nhạc */
  bytes: Uint8Array;
  /** Tên file gốc — chỉ để hiển thị trong kho */
  fileName: string;
  mime?: string;
  /** Nhãn cho nút bật/tắt, trình đọc màn hình đọc chuỗi này */
  title?: string;
  iconColor?: string;
}

export interface AttachAudioResult {
  invite: InviteRow;
  /** Mẫu sau khi xong — bản sao nếu vừa nhân bản, còn không thì chính mẫu cũ */
  template: TemplateRow;
  /** Mẫu ban đầu, để gọi bên ngoài in ra cho người chạy đối chiếu */
  sourceTemplate: TemplateRow;
  cloned: boolean;
  asset: StoredAsset;
  audio: AudioConfig;
}

export type AttachAudioError = { error: string };

export function isAttachError(x: unknown): x is AttachAudioError {
  return typeof x === 'object' && x !== null && 'error' in x;
}

/** Tên đặt cho bản sao: kèm slug thiệp để hai đám cưới không ra cùng một tên */
export function cloneName(sourceName: string, inviteSlug: string): string {
  return `${sourceName} — ${inviteSlug}`;
}

/**
 * Mẫu này có phải của riêng chủ thiệp không, hay là hàng dùng chung?
 *
 * Ba câu hỏi, vì một câu không đủ:
 *
 *   1. Chủ khác chủ thiệp   → rõ ràng là của người khác.
 *   2. Còn `builtin_hash`   → app seed xuống, tức mẫu dựng sẵn của thư viện.
 *      Cần câu này vì mẫu dựng sẵn thuộc về tài khoản admin, mà admin cũng tự
 *      tạo thiệp cho mình — lúc đó câu 1 nói "của bạn mà" và ta sửa thẳng vào
 *      mẫu mọi cặp đôi khác đang dùng.
 *   3. Trùng slug mẫu dựng sẵn → hàng có từ trước khi cột `builtin_hash` ra
 *      đời thì cột đó null, câu 2 không bắt được.
 */
export async function isSharedTemplate(
  template: TemplateRow,
  inviteOwnerId: string,
): Promise<boolean> {
  if (template.ownerId !== inviteOwnerId) return true;
  if (await templateBuiltinHash(template.id)) return true;

  const { builtinTemplates } = await import('./seed');
  return builtinTemplates().some((doc) => doc.slug === template.slug);
}

export async function attachAudio(
  input: AttachAudioInput,
): Promise<AttachAudioResult | AttachAudioError> {
  const invite = await getInviteBySlug(input.inviteSlug);
  if (!invite) return { error: `Không có thiệp nào mang slug "${input.inviteSlug}"` };

  const source = await getTemplateById(invite.templateId);
  if (!source) return { error: `Thiệp trỏ tới mẫu ${invite.templateId} mà mẫu đó không còn` };

  const shared = await isSharedTemplate(source, invite.ownerId);

  let template = source;
  if (shared) {
    const id = `tpl-${crypto.randomUUID()}`;
    const name = cloneName(source.name, invite.slug);
    const slug = uniqueSlug(name, await allSlugs('templates'));

    // Đổi danh tính trong chính doc, nếu không bản sao vẫn mang id/slug bản gốc
    const copy = unpackDoc(source.docPacked);
    copy.id = id;
    copy.slug = slug;
    copy.name = name;

    template = await createTemplate({
      id, slug, name,
      ownerId: invite.ownerId,
      docPacked: packDoc(copy),
      thumbnail: source.thumbnail,
      usageCount: 0,
    });
  }

  // Sao lại thành Uint8Array "thuần": Buffer của Node khai kiểu đệm rộng hơn
  // (kể cả SharedArrayBuffer) nên không lọt thẳng vào File được.
  const file = new File([new Uint8Array(input.bytes)], input.fileName, {
    type: input.mime ?? 'audio/mpeg',
  });
  const stored = await storeUpload(file);
  if ('error' in stored) return { error: `Không lưu được nhạc: ${stored.error}` };

  /**
   * `storeUpload` sinh key mới mỗi lần nên hàng `assets` gần như không đụng độ
   * — nhưng "gần như" là chưa đủ để cứ thế insert và ăn lỗi khoá trùng.
   */
  if (!(await getAssetByKey(stored.key))) {
    await createAsset({
      id: stored.id,
      key: stored.key,
      ownerId: invite.ownerId,
      mime: stored.mime,
      width: stored.width,
      height: stored.height,
      bytes: stored.bytes,
      originalName: input.fileName.slice(0, 200),
    });
  }

  const audio: AudioConfig = {
    key: stored.key,
    title: input.title ?? 'Nhạc nền thiệp cưới',
    /**
     * Không tự phát: điện thoại chặn tiếng khi trang chưa được chạm. Thiệp nào
     * cũng mở bằng một cú chạm vào bì thư, và nhạc bật ngay trong cú chạm đó
     * (xem components/AudioToggle.tsx) — nên `autoplay` chỉ tổ làm nút hiện sai
     * trạng thái ở lần thử trượt đầu tiên.
     */
    autoplay: false,
    loop: true,
    icon: '♪',
    iconColor: input.iconColor ?? '#7a2c2c',
  };

  const doc = unpackDoc(template.docPacked);
  doc.audio = audio;
  const saved = await updateTemplate(template.id, { docPacked: packDoc(doc) });
  if (!saved) return { error: `Lưu mẫu ${template.id} không thành` };

  let finalInvite = invite;
  if (shared) {
    const moved = await updateInvite(invite.id, { templateId: saved.id });
    if (!moved) return { error: `Không trỏ được thiệp ${invite.id} sang mẫu mới` };
    finalInvite = moved;
  }

  return {
    invite: finalInvite,
    template: saved,
    sourceTemplate: source,
    cloned: shared,
    asset: stored,
    audio,
  };
}
