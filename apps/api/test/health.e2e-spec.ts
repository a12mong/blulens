import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module';
import { EnvelopeInterceptor } from '../src/common/interceptors/envelope.interceptor';

describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new EnvelopeInterceptor());
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 200 with status ok (no DB needed)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });
});
