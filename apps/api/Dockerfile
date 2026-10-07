# syntax=docker/dockerfile:1
# Build จาก root ของ repo (ต้องเห็นทั้ง workspace):
#   docker build -f apps/api/Dockerfile -t blulens-api .
#
# ใช้ debian slim (ไม่ใช่ alpine) เพราะ prisma engines / native deps
# มี prebuilt binary ฝั่ง glibc ครบ ไม่ต้องลาก toolchain มา compile

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl จำเป็นสำหรับ prisma engines บน debian slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# ---- build: ติดตั้ง deps ทั้ง workspace ที่เกี่ยว → build shared → generate → build api ----
FROM base AS build
# tsconfig.base.json ต้องมาด้วย — tsconfig ของทุก package extends จากตัวนี้
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# --filter @blulens/api... = api + dependencies (shared) / --filter blulens = devDeps ระดับ root
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @blulens/api... --filter blulens
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @blulens/shared build \
  && pnpm --filter @blulens/api exec prisma generate \
  && pnpm --filter @blulens/api build
# สร้างชุด production ที่ /out: ไฟล์ของ package (dist/prisma) + node_modules เฉพาะ prod deps
# แล้ว generate prisma client ซ้ำใน /out (pnpm deploy ติดตั้ง node_modules ใหม่ client เดิมไม่ติดมา)
# --legacy: pnpm v10 บังคับเลือกโหมด — โหมด legacy ก็อป workspace deps (@blulens/shared
# พร้อม dist ที่ build แล้ว) เข้า node_modules ตรง ๆ ซึ่งคือสิ่งที่ต้องการพอดี
RUN pnpm --filter @blulens/api deploy --prod --legacy /out \
  && pnpm --filter @blulens/api exec prisma generate --schema=/out/prisma/schema.prisma

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# prisma CLI สำหรับ `prisma migrate deploy` ตอน deploy — ช่วง version เดียวกับ
# @prisma/client ใน apps/api/package.json จะได้ resolve เป็นรุ่นใกล้เคียงกัน
RUN npm install -g "prisma@^6.6.0" && npm cache clean --force
COPY --from=build /out ./
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
