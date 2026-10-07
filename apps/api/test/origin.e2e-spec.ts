import { Controller, Post, UseGuards, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { allowedOrigins, isAllowedOrigin } from '../src/common/auth/allowed-origins';
import { OriginGuard } from '../src/common/auth/origin.guard';
import { AppModule } from '../src/app.module';

describe('allowed-origins', () => {
  describe('allowedOrigins', () => {
    it('parses WEB_URLS (comma-separated, trimmed)', () => {
      const result = allowedOrigins({
        WEB_URLS: ' http://localhost:3100/ , http://localhost:3190 ',
      });
      expect(result).toEqual(['http://localhost:3100', 'http://localhost:3190']);
    });

    it('falls back to WEB_URL if WEB_URLS not set', () => {
      const result = allowedOrigins({
        WEB_URL: 'https://blulens.example/app',
      });
      expect(result).toEqual(['https://blulens.example']);
    });

    it('defaults to http://localhost:3100 if neither WEB_URLS nor WEB_URL set', () => {
      const result = allowedOrigins({});
      expect(result).toEqual(['http://localhost:3100']);
    });

    it('normalizes URLs (removes trailing slash and path)', () => {
      const result = allowedOrigins({
        WEB_URLS: 'http://example.com:8080/app/',
      });
      expect(result).toEqual(['http://example.com:8080']);
    });

    it('throws on invalid URL in WEB_URLS', () => {
      expect(() =>
        allowedOrigins({
          WEB_URLS: 'not a url',
        })
      ).toThrow();
    });

    it('skips empty strings in WEB_URLS', () => {
      const result = allowedOrigins({
        WEB_URLS: ' http://localhost:3100 , , http://localhost:3190 ',
      });
      expect(result).toEqual(['http://localhost:3100', 'http://localhost:3190']);
    });
  });

  describe('isAllowedOrigin', () => {
    it('returns true if origin in allowed list', () => {
      expect(isAllowedOrigin('http://localhost:3100', ['http://localhost:3100'], 'production')).toBe(true);
    });

    it('allows any http://localhost:<port> in development', () => {
      expect(isAllowedOrigin('http://localhost:3190', ['http://localhost:3100'], 'development')).toBe(true);
    });

    it('allows 127.0.0.1 in development', () => {
      expect(isAllowedOrigin('http://127.0.0.1:3190', ['http://localhost:3100'], 'development')).toBe(true);
    });

    it('rejects https://localhost in development', () => {
      expect(isAllowedOrigin('https://localhost:3190', ['http://localhost:3100'], 'development')).toBe(false);
    });

    it('rejects non-localhost subdomains in development', () => {
      expect(isAllowedOrigin('http://localhost.evil.com:3100', ['http://localhost:3100'], 'development')).toBe(false);
    });

    it('rejects private IP addresses in development', () => {
      expect(isAllowedOrigin('http://192.168.1.5:3100', ['http://localhost:3100'], 'development')).toBe(false);
    });

    it('rejects null origin in development', () => {
      expect(isAllowedOrigin('null', ['http://localhost:3100'], 'development')).toBe(false);
    });

    it('rejects localhost in production', () => {
      expect(isAllowedOrigin('http://localhost:3190', ['http://localhost:3100'], 'production')).toBe(false);
    });

    it('rejects localhost when nodeEnv is undefined', () => {
      expect(isAllowedOrigin('http://localhost:3190', ['http://localhost:3100'], undefined)).toBe(false);
    });
  });

  describe('OriginGuard HTTP integration', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const mod = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = mod.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.use(cookieParser());
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows GET requests even with foreign origin (no origin guard)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://evil.example.com')
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('allows requests without Origin header to /api/health', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });
});
