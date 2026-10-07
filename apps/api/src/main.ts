import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { allowedOrigins, isAllowedOrigin } from './common/auth/allowed-origins';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // openapi servers: /api/v1
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  // Jim D-S1: Docker/Caddy probes keep using /api/health; the contract path is /api/v1/health
  app.getHttpAdapter().get('/api/health', (_req: unknown, res: { json: (b: unknown) => void }) =>
    res.json({ success: true, data: { status: 'ok' } }),
  );
  const allowed = allowedOrigins(process.env);
  const nodeEnv = process.env.NODE_ENV;
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || isAllowedOrigin(origin, allowed, nodeEnv)),
    credentials: true,
  });
  // ให้ req.ip ถูกต้องเมื่ออยู่หลัง proxy (Next.js rewrite / Caddy)
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('blulens API')
    .setDescription('ระบบประเมินฝีมือ จัดการงานแข่ง และจับสายการแข่งขัน')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.API_PORT ?? 3101);
  await app.listen(port);
  new Logger('Bootstrap').log(`API พร้อมใช้งานที่ http://localhost:${port}/api/v1 (docs: /api/docs)`);
}

void bootstrap();
