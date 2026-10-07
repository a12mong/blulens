import type { NextConfig } from 'next';

// อ่านตอน build เท่านั้น — rewrites() ถูก serialize ลง routes-manifest; ใน image ฝังเป็น http://api:3001
// (ชื่อ service ภายใน compose เหมือนกันทั้ง live/dev) — ตั้ง env ตอน runtime จะไม่มีผล
const API_URL = process.env.API_URL ?? 'http://localhost:3101';

const nextConfig: NextConfig = {
  // สำหรับ Docker image — ได้ server.js + node_modules เฉพาะที่ใช้จริง (apps/web/Dockerfile
  // เป็นคนตั้ง BUILD_STANDALONE=1) — เปิดเฉพาะใน Docker เพราะ standalone ทำให้ `next start` ปกติใช้ไม่ได้
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  // รัน dev อีก instance คู่ขนาน (เช่น stack ทดสอบชี้ test DB) ต้องแยก build dir
  // ไม่งั้น .next ชนกับ dev หลักจน webpack module พัง
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // หมายเหตุ: ห้ามใส่ @blulens/shared ใน transpilePackages — dist เป็น CJS ที่ compile แล้ว
  // และ react-refresh loader จะฉีด import.meta ลงไฟล์ CJS จนพังตอน dev
  async rewrites() {
    // proxy ทุก /api/* ไป NestJS — cookie เป็น same-origin ไม่ต้องยุ่ง CORS
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
