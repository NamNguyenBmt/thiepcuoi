/**
 * Nơi chứa file thật của ảnh.
 *
 * Hai hiện thực, cùng một interface ba hàm:
 *   - có S3_BUCKET → S3 hoặc bất cứ thứ gì nói giao thức S3 (R2, MinIO, B2…)
 *   - không có     → đĩa cục bộ (`.data/uploads`), đủ cho dev
 *
 * `AssetKey` trong `TemplateDoc` không đổi theo nơi chứa: nó vẫn là
 * "uploads/<uuid>.<ext>", còn đây chỉ là chỗ đọc/ghi byte. Đổi kho không cần
 * đụng tới mẫu thiệp nào.
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from './once';

export interface BlobStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Mô tả ngắn để in ra log lúc khởi động — biết mình đang ghi vào đâu */
  describe(): string;
}

// ─────────────────────────── Đĩa cục bộ ───────────────────────────

/**
 * Đọc muộn, không phải hằng số ở đầu module: script nạp `.env.local` sau khi
 * import đã chạy (ESM hoist import lên trên), nên đọc sớm là lấy nhầm giá trị.
 */
const uploadDir = () => process.env.UPLOAD_DIR ?? join(process.cwd(), '.data', 'uploads');

/** Key đã qua `isValidKey` nên chỉ cần lấy phần tên file; không bao giờ join thẳng key */
const fileName = (key: string) => key.slice('uploads/'.length);

function diskStore(): BlobStore {
  const dir = uploadDir();
  return {
    put: async (key, data) => {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, fileName(key)), data);
    },
    get: (key) => readFile(join(dir, fileName(key))),
    remove: (key) => unlink(join(dir, fileName(key))),
    describe: () => `đĩa cục bộ (${dir})`,
  };
}

// ─────────────────────────── S3 / R2 ───────────────────────────

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function readS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    // R2 không có khái niệm region, tài liệu của họ bảo dùng "auto"
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    // MinIO và nhiều S3 tự host chỉ chạy được kiểu path-style
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  };
}

async function s3Store(config: S3Config): Promise<BlobStore> {
  const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = await import(
    '@aws-sdk/client-s3'
  );

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    put: async (key, data, contentType) => {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          // Ảnh là bất biến: key chứa uuid nên nội dung dưới một key không đổi
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    },

    get: async (key) => {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!result.Body) throw new Error(`Không đọc được ${key}`);
      // transformToByteArray gom cả stream — ảnh đã bị chặn ở 12 MB nên an toàn
      return Buffer.from(await result.Body.transformToByteArray());
    },

    remove: async (key) => {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },

    describe: () => `S3 bucket ${config.bucket}${config.endpoint ? ` @ ${config.endpoint}` : ''}`,
  };
}

// ─────────────────────────── Chọn một lần ───────────────────────────

const store = once(async () => {
  const config = readS3Config();
  const chosen = config ? await s3Store(config) : diskStore();
  console.log(`[assets] đang dùng ${chosen.describe()}`);
  return chosen;
});

export function getBlobStore(): Promise<BlobStore> {
  return store.get();
}

/** Chỉ dùng trong test: quên lựa chọn cũ để lần sau đọc lại biến môi trường */
export function resetBlobStore(): void {
  store.reset();
}
