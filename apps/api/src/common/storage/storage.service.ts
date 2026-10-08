import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Presigned URLs live 15 minutes (architecture.md: upload and playback). */
export const PRESIGN_TTL_SEC = 15 * 60;
export const CLIP_MAX_BYTES = 524_288_000;
export const CLIP_MAX_DURATION_SEC = 300;
export const CLIP_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;
export type ClipContentType = (typeof CLIP_CONTENT_TYPES)[number];

export interface PresignedUrl {
  url: string;
  expiresAt: Date;
}

export interface StoredObject {
  sizeBytes: number;
  contentType: string | null;
}

const extensionFor = (contentType: ClipContentType) => (contentType === 'video/quicktime' ? 'mov' : 'mp4');

/** clips/<assessmentId>/<clipId>.<ext> */
export const assessmentClipKey = (assessmentId: string, clipId: string, contentType: ClipContentType) =>
  `clips/${assessmentId}/${clipId}.${extensionFor(contentType)}`;

/** calibration/<setId>/<clipId>.<ext> */
export const calibrationClipKey = (setId: string, clipId: string, contentType: ClipContentType) =>
  `calibration/${setId}/${clipId}.${extensionFor(contentType)}`;

/** Seeded demo clips use a web path or a full URL instead of a bucket key; those are served as-is. */
const isExternalKey = (objectKey: string) =>
  objectKey.startsWith('/') || objectKey.startsWith('http://') || objectKey.startsWith('https://');

/**
 * S3-compatible clip storage (MinIO in dev). Two clients: `internal` talks to S3_ENDPOINT from the API,
 * `public` signs URLs with S3_PUBLIC_ENDPOINT so the browser can reach them.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly internal: S3Client;
  private readonly public: S3Client;
  readonly bucket: string;
  private bucketReady: Promise<void> | null = null;

  constructor(config: ConfigService) {
    const credentials = {
      accessKeyId: config.get<string>('S3_ACCESS_KEY') ?? '',
      secretAccessKey: config.get<string>('S3_SECRET_KEY') ?? '',
    };
    const region = config.get<string>('S3_REGION') ?? 'us-east-1';
    const endpoint = config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9100';
    this.internal = new S3Client({ endpoint, region, credentials, forcePathStyle: true });
    this.public = new S3Client({
      endpoint: config.get<string>('S3_PUBLIC_ENDPOINT') ?? endpoint,
      region,
      credentials,
      forcePathStyle: true,
    });
    this.bucket = config.get<string>('S3_BUCKET') ?? 'clips';
  }

  /** Creates the private bucket on first use (dev/test); a no-op when it exists. */
  ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      try {
        await this.internal.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch {
        await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`created bucket ${this.bucket}`);
      }
    })().catch((err: unknown) => {
      this.bucketReady = null;
      throw err;
    });
    return this.bucketReady;
  }

  /** Presigned PUT; the browser must send exactly this Content-Type. */
  async presignPut(objectKey: string, contentType: ClipContentType, now = new Date()): Promise<PresignedUrl> {
    await this.ensureBucket();
    const url = await getSignedUrl(
      this.public,
      new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, ContentType: contentType }),
      // sign Content-Type so an upload with another type fails the signature (403)
      { expiresIn: PRESIGN_TTL_SEC, signableHeaders: new Set(['content-type']) },
    );
    return { url, expiresAt: new Date(now.getTime() + PRESIGN_TTL_SEC * 1000) };
  }

  async presignGet(objectKey: string, now = new Date()): Promise<PresignedUrl> {
    if (isExternalKey(objectKey)) {
      return { url: objectKey, expiresAt: new Date(now.getTime() + PRESIGN_TTL_SEC * 1000) };
    }
    const url = await getSignedUrl(this.public, new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }), {
      expiresIn: PRESIGN_TTL_SEC,
    });
    return { url, expiresAt: new Date(now.getTime() + PRESIGN_TTL_SEC * 1000) };
  }

  /** Size and type of an uploaded object; null when nothing was uploaded under the key. */
  async head(objectKey: string): Promise<StoredObject | null> {
    try {
      const res = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return { sizeBytes: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? null };
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') return null;
      throw err;
    }
  }

  /** Clip viewUrl rule: null unless uploaded; seeded external keys pass through; bucket keys get a presigned GET. */
  async viewUrl(status: string, objectKey: string): Promise<string | null> {
    if (status !== 'uploaded') return null;
    return (await this.presignGet(objectKey)).url;
  }
}
