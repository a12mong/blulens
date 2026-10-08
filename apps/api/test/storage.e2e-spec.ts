import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import {
  assessmentClipKey,
  calibrationClipKey,
  PRESIGN_TTL_SEC,
  StorageService,
} from '../src/common/storage/storage.service';

describe('StorageService against MinIO (bl-36-1)', () => {
  let app: INestApplication;
  let storage: StorageService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    storage = app.get(StorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('object keys follow clips/<assessmentId>/<clipId>.<ext> and calibration/<setId>/<clipId>.<ext>', () => {
    expect(assessmentClipKey('a1', 'c1', 'video/mp4')).toBe('clips/a1/c1.mp4');
    expect(assessmentClipKey('a1', 'c1', 'video/quicktime')).toBe('clips/a1/c1.mov');
    expect(calibrationClipKey('s1', 'c1', 'video/mp4')).toBe('calibration/s1/c1.mp4');
  });

  it('uses a test bucket, never the dev bucket', () => {
    expect(storage.bucket.endsWith('-test')).toBe(true);
  });

  it('presigned PUT uploads, head reports size and type, presigned GET returns the bytes', async () => {
    const key = assessmentClipKey(randomUUID(), randomUUID(), 'video/mp4');
    const body = Buffer.from('not really a video, 34 bytes long!');
    const now = new Date();

    expect(await storage.head(key)).toBeNull();

    const put = await storage.presignPut(key, 'video/mp4', now);
    expect(put.expiresAt.getTime()).toBe(now.getTime() + PRESIGN_TTL_SEC * 1000);
    expect(put.url).toContain('X-Amz-Expires=900');
    const upload = await fetch(put.url, { method: 'PUT', body, headers: { 'Content-Type': 'video/mp4' } });
    expect(upload.status).toBe(200);

    expect(await storage.head(key)).toEqual({ sizeBytes: body.length, contentType: 'video/mp4' });

    const viewUrl = await storage.viewUrl('uploaded', key);
    expect(viewUrl).toEqual(expect.any(String));
    const download = await fetch(viewUrl!);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).equals(body)).toBe(true);
  });

  it('presigned PUT with a different Content-Type is rejected by the signature', async () => {
    const key = calibrationClipKey(randomUUID(), randomUUID(), 'video/mp4');
    const put = await storage.presignPut(key, 'video/mp4');
    const upload = await fetch(put.url, { method: 'PUT', body: 'x', headers: { 'Content-Type': 'text/plain' } });
    expect(upload.status).toBe(403);
    expect(await storage.head(key)).toBeNull();
  });

  it('viewUrl: null unless uploaded; seeded web-path and http keys pass through', async () => {
    expect(await storage.viewUrl('pending_upload', 'clips/a/b.mp4')).toBeNull();
    expect(await storage.viewUrl('rejected', '/e2e/sample.mp4')).toBeNull();
    expect(await storage.viewUrl('uploaded', '/e2e/sample.mp4?c=1')).toBe('/e2e/sample.mp4?c=1');
    expect(await storage.viewUrl('uploaded', 'https://cdn.example/x.mp4')).toBe('https://cdn.example/x.mp4');
  });
});
