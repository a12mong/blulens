import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3100',
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
  new Logger('Bootstrap').log(`API พร้อมใช้งานที่ http://localhost:${port}/api (docs: /api/docs)`);
}

void bootstrap();
