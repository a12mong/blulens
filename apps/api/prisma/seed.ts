/**
 * Idempotent seed (bl-07): bootstrap Admin from env + the active grading-v1 rubric.
 * Roles are a fixed enum (A2), so there is nothing to seed for them.
 * Run: pnpm db:seed   (reads ../../.env; SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto/password';

const prisma = new PrismaClient();

// grading.md v1 §3 (G1: six criteria, equal weight) and appendix B parameters (G8, G10).
const GRADING_V1 = {
  methodVersion: 'grading-v1',
  criteria: [
    { key: 'footwork', nameTh: 'การเคลื่อนที่/ฟุตเวิร์ก', weight: 1 },
    { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ (เคลียร์ ดรอป ตบ)', weight: 1 },
    { key: 'net', nameTh: 'หน้าตาข่าย (หยอด ตัด งัด)', weight: 1 },
    { key: 'defense', nameTh: 'การรับ/ป้องกัน', weight: 1 },
    { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', weight: 1 },
    { key: 'consistency', nameTh: 'ความสม่ำเสมอ/การควบคุมลูก', weight: 1 },
  ],
  params: {
    nMin: 3,
    outlierMinDeviation: 2.0,
    outlierMinRobustZ: 3.5,
    marginConfidence: 0.8,
    marginMin: 0.25,
    marginMax: 3.0,
    disputedSpread: 3.0,
    disputedMargin: 1.5,
  },
};

async function seedAdmin(): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return 'admin: skipped (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set)';

  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing ??
    (await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), displayName: 'ผู้ดูแลระบบ' },
    }));
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: 'Admin' } },
    create: { userId: user.id, role: 'Admin' },
    update: {},
  });
  // the password of an existing admin is never overwritten by a re-run
  return `admin: ${existing ? 'exists' : 'created'} (${email})`;
}

async function seedRubric(): Promise<string> {
  const existing = await prisma.rubric.findUnique({ where: { methodVersion: GRADING_V1.methodVersion } });
  if (existing) return 'rubric grading-v1: exists';
  const anyActive = await prisma.rubric.findFirst({ where: { active: true } });
  await prisma.rubric.create({ data: { ...GRADING_V1, active: !anyActive } });
  return `rubric grading-v1: created (active=${!anyActive})`;
}

async function main() {
  console.log(await seedAdmin());
  console.log(await seedRubric());
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
