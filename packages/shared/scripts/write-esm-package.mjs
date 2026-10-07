// ทำให้ dist/esm ถูกตีความเป็น ES module (web/webpack ใช้ทางนี้, NestJS ใช้ CJS ที่ dist/)
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync(new URL('../dist/esm', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../dist/esm/package.json', import.meta.url),
  JSON.stringify({ type: 'module' }, null, 2),
);
