# syntax=docker/dockerfile:1
# Build จาก root ของ repo (ต้องเห็นทั้ง workspace):
#   docker build -f apps/web/Dockerfile -t blulens-web .

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ---- build ----
FROM base AS build
# tsconfig.base.json ต้องมาด้วย — tsconfig ของทุก package extends จากตัวนี้
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @blulens/web... --filter blulens
COPY packages/shared packages/shared
COPY apps/web apps/web
# API_URL ถูกฝังลง rewrite ตอน build — ใช้ชื่อ service ภายใน compose (`api`)
# ซึ่งเหมือนกันทั้ง live และ dev จึงใช้ image เดียวกันได้สองฝั่ง
ENV BUILD_STANDALONE=1 API_URL=http://api:3001 NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @blulens/shared build && pnpm --filter @blulens/web build

# ---- runtime: เอาเฉพาะ standalone output ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# standalone ของ monorepo คงโครง repo ไว้ — entrypoint คือ apps/web/server.js
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
