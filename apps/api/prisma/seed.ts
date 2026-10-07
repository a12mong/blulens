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

// ---------------------------------------------------------------- demo data (dev only: SEED_DEMO=1)

const GRADE_KEYS = ['RK1', 'RK2', 'RK3', 'BG1', 'BG2', 'BG3', 'S-', 'S', 'S+', 'N-', 'N', 'N+', 'P-', 'P', 'P+'];

/** name_key / alias_key are already normalised (lower-case, single spaces). */
const DEMO_TEAMS = [
  { name: 'Blue Wing', nameKey: 'blue wing', alias: { alias: 'บลูวิง', aliasKey: 'บลูวิง' } },
  { name: 'Red Phoenix', nameKey: 'red phoenix', alias: null },
  { name: 'Green Valley', nameKey: 'green valley', alias: null },
];

/** member6 is in two teams on purpose, to show the MULTI_TEAM warning (A11). */
const DEMO_MEMBERS = [
  { n: 1, name: 'สมชาย ใจดี', grade: 6, teams: ['blue wing'] },
  { n: 2, name: 'วิภา ศรีสุข', grade: 7, teams: ['blue wing'] },
  { n: 3, name: 'ธนา รุ่งเรือง', grade: 8, teams: ['red phoenix'] },
  { n: 4, name: 'มาลี สายสมร', grade: 9, teams: ['red phoenix'] },
  { n: 5, name: 'กิตติ พานทอง', grade: 10, teams: ['green valley'] },
  { n: 6, name: 'นภา ทองดี', grade: 7, teams: ['blue wing', 'green valley'] },
];

async function upsertUser(email: string, displayName: string, password: string, roles: Array<'Committee' | 'Member'>) {
  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing ?? (await prisma.user.create({ data: { email, displayName, passwordHash: await hashPassword(password) } }));
  for (const role of roles) {
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      create: { userId: user.id, role },
      update: {},
    });
  }
  return user;
}

async function seedDemo(): Promise<string> {
  if (process.env.SEED_DEMO !== '1') return 'demo: skipped (SEED_DEMO != 1)';
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) return 'demo: skipped (SEED_DEMO_PASSWORD not set)';

  // D-S2: in dev the bootstrap admin also holds Committee, so it can create events and entries
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const admin = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail } }) : null;
  if (admin) {
    await prisma.userRole.upsert({
      where: { userId_role: { userId: admin.id, role: 'Committee' } },
      create: { userId: admin.id, role: 'Committee' },
      update: {},
    });
  }

  await upsertUser('committee@blulens.local', 'คณะกรรมการ (เดโม)', password, ['Committee']);

  const teamIdByKey = new Map<string, string>();
  for (const t of DEMO_TEAMS) {
    const team = await prisma.team.upsert({
      where: { nameKey: t.nameKey },
      create: { name: t.name, nameKey: t.nameKey },
      update: {},
    });
    teamIdByKey.set(t.nameKey, team.id);
    if (t.alias) {
      await prisma.teamAlias.upsert({
        where: { aliasKey: t.alias.aliasKey },
        create: { teamId: team.id, ...t.alias },
        update: {},
      });
    }
  }

  const rubric = await prisma.rubric.findUnique({ where: { methodVersion: 'grading-v1' } });
  for (const m of DEMO_MEMBERS) {
    const user = await upsertUser(`member${m.n}@blulens.local`, m.name, password, ['Member']);
    for (const key of m.teams) {
      const teamId = teamIdByKey.get(key)!;
      const open = await prisma.teamMembership.findFirst({ where: { userId: user.id, teamId, validTo: null } });
      if (!open) await prisma.teamMembership.create({ data: { userId: user.id, teamId } });
    }
    // D-S3: an official grade so entries pass the grade checks (an override result: margin 0, exact)
    const graded = await prisma.assessmentResult.findFirst({
      where: { status: { in: ['approved', 'overridden'] }, assessment: { subjectUserId: user.id } },
    });
    if (!graded) {
      const assessment = await prisma.assessment.create({
        data: { subjectUserId: user.id, rubricId: rubric?.id, status: 'overridden', submittedAt: new Date() },
      });
      await prisma.assessmentResult.create({
        data: {
          assessmentId: assessment.id,
          version: 1,
          source: 'override',
          status: 'overridden',
          score: m.grade + 0.5,
          margin: 0,
          lowerIndex: m.grade,
          centerIndex: m.grade,
          upperIndex: m.grade,
          kind: 'exact',
          label: GRADE_KEYS[m.grade]!,
          nRaters: 0,
          flags: ['OVERRIDE'],
          methodVersion: 'grading-v1',
          inputs: { demoSeed: true },
          reason: 'demo seed: slice 1 sample grade',
          computedBy: admin?.id ?? null,
        },
      });
    }
  }
  return `demo: ok (committee + ${DEMO_MEMBERS.length} members, ${DEMO_TEAMS.length} teams${admin ? ', admin += Committee' : ''})`;
}

async function main() {
  console.log(await seedAdmin());
  console.log(await seedRubric());
  console.log(await seedDemo());
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
