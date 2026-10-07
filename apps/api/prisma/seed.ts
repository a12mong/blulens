/**
 * Idempotent seed (bl-07): bootstrap Admin from env + the active grading-v1 rubric.
 * Roles are a fixed enum (A2), so there is nothing to seed for them.
 * Run: pnpm db:seed   (reads ../../.env; SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto/password';
import { normalizeTeamName } from '@blulens/shared';

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
  // Thai clubs for bl-21-8 demo realism
  { name: 'ชมรมแบดมินตันบางเขน', nameKey: normalizeTeamName('ชมรมแบดมินตันบางเขน'), alias: null },
  { name: 'สโมสรลูกขนไก่นนทบุรี', nameKey: normalizeTeamName('สโมสรลูกขนไก่นนทบุรี'), alias: null },
  { name: 'บ้านแบด สุขุมวิท', nameKey: normalizeTeamName('บ้านแบด สุขุมวิท'), alias: null },
];

/** member6 is in two teams on purpose, to show the MULTI_TEAM warning (A11). */
const DEMO_MEMBERS = [
  { n: 1, name: 'สมชาย ใจดี', grade: 6, teams: ['blue wing'] },
  { n: 2, name: 'วิภา ศรีสุข', grade: 7, teams: ['blue wing'] },
  { n: 3, name: 'ธนา รุ่งเรือง', grade: 8, teams: ['red phoenix'] },
  { n: 4, name: 'มาลี สายสมร', grade: 9, teams: ['red phoenix'] },
  { n: 5, name: 'กิตติ พานทอง', grade: 10, teams: ['green valley'] },
  { n: 6, name: 'นภา ทองดี', grade: 7, teams: ['blue wing', 'green valley'] },
  // Members 7..14 for bl-21-8 demo tournament (grades for MD S-..S+: 6,6,7,7,8,8,7,6)
  { n: 7, name: 'ประสิทธิ์ เนตรดี', grade: 6, teams: ['ชมรมแบดมินตันบางเขน'] },
  { n: 8, name: 'ชิดชนัย วิชัยศรม', grade: 6, teams: ['สโมสรลูกขนไก่นนทบุรี'] },
  { n: 9, name: 'ธัญญา ครุธนนต์', grade: 7, teams: ['บ้านแบด สุขุมวิท'] },
  { n: 10, name: 'เสกสรร ศรีสวัสดิ์', grade: 7, teams: ['ชมรมแบดมินตันบางเขน'] },
  { n: 11, name: 'ปัญญา พิบูลย์พจน์', grade: 8, teams: ['สโมสรลูกขนไก่นนทบุรี'] },
  { n: 12, name: 'จตุรนต์ ดำรงค์', grade: 8, teams: ['บ้านแบด สุขุมวิท'] },
  { n: 13, name: 'สุทธิดา วงศ์วิทยา', grade: 7, teams: ['ชมรมแบดมินตันบางเขน'] },
  { n: 14, name: 'ปิยะพัฒน์ เกิดสถาน', grade: 6, teams: ['สโมสรลูกขนไก่นนทบุรี'] },
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

async function seedDemoTournament(adminId: string | null): Promise<{ created: number; draftCreated: boolean }> {
  const tournamentName = 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3';
  const draftTournamentName = 'แบดมินตันสัมพันธ์ประจำเดือน';

  // Check if tournament already exists (idempotent)
  const existing = await prisma.tournament.findFirst({
    where: { name: tournamentName },
  });
  if (existing) return { created: 0, draftCreated: false };

  // Calculate Bangkok date (UTC + 7)
  const bangkokDate = new Date(Date.now() + 7 * 3600e3);
  const today = bangkokDate.toISOString().slice(0, 10);
  const startsOn = new Date(`${today}T00:00:00Z`);
  startsOn.setUTCDate(startsOn.getUTCDate() + 21);

  // entriesCloseAt = startsOn - 5 days at 17:00 Bangkok (= 10:00 UTC)
  const entriesCloseAt = new Date(startsOn);
  entriesCloseAt.setUTCDate(entriesCloseAt.getUTCDate() - 5);
  entriesCloseAt.setUTCHours(10, 0, 0, 0);

  // Build map of user ID to grade info by finding assessments for each demo member
  const userGradeMap = new Map<string, { grade: number; resultId: string; teamKey: string }>();

  // Query member users and their assessment results (via assessment)
  for (const memberDef of DEMO_MEMBERS) {
    const memberEmail = `member${memberDef.n}@blulens.local`;
    const user = await prisma.user.findUnique({ where: { email: memberEmail } });
    if (!user) continue;

    // Find assessment with result for this user
    const assessmentWithResult = await prisma.assessment.findFirst({
      where: { subjectUserId: user.id },
      include: { results: { where: { status: 'overridden' } } },
    });

    if (assessmentWithResult && assessmentWithResult.results.length > 0) {
      const result = assessmentWithResult.results[0];
      if (result.lowerIndex !== null) {
        const teamKey = memberDef.teams[0];
        userGradeMap.set(user.id, {
          grade: result.lowerIndex,
          resultId: result.id,
          teamKey,
        });
      }
    }
  }

  // Get team IDs by key
  const teams = await prisma.team.findMany({});
  const teamByKey = new Map<string, string>();
  for (const team of teams) {
    teamByKey.set(team.nameKey, team.id);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create main tournament (open)
    const tournament = await tx.tournament.create({
      data: {
        name: tournamentName,
        venue: 'ศูนย์กีฬาแบดมินตัน ซอยลาดพร้าว 71',
        status: 'open',
        startsOn,
        entriesCloseAt,
      },
    });

    const now = new Date();

    // Create events
    const mdEvent = await tx.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MD',
        gradeMinIndex: 6, // S-
        gradeMaxIndex: 8, // S+
        maxEntries: 16,
        minReviewers: 2,
      },
    });

    const xdEvent = await tx.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'XD',
        gradeMinIndex: 5, // BG3
        gradeMaxIndex: 7, // S
        maxEntries: 12,
        minReviewers: 2,
      },
    });

    const msEvent = await tx.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MS',
        gradeMinIndex: 7, // S
        gradeMaxIndex: 10, // N
        maxEntries: 16,
        minReviewers: 2,
      },
    });

    // MD: 3 approved + 2 pending from members 7..14 (and 1..2 if needed)
    const mdCandidates = Array.from(userGradeMap.entries())
      .filter(([_, info]) => info.grade >= 6 && info.grade <= 8)
      .map(([userId, info]) => ({ userId, ...info }));

    const mdApprovedCount = 3;
    const mdPendingCount = 2;
    for (let i = 0; i < mdApprovedCount && i < mdCandidates.length; i++) {
      const candidate = mdCandidates[i];
      const teamId = teamByKey.get(candidate.teamKey) || '';
      if (teamId) {
        const entry = await tx.entry.create({
          data: {
            eventId: mdEvent.id,
            status: 'approved',
            forwardedAt: now,
            decidedAt: now,
            decidedBy: adminId ?? null,
          },
        });
        await tx.entryPlayer.create({
          data: {
            entryId: entry.id,
            userId: candidate.userId,
            eventId: mdEvent.id,
            gradeResultId: candidate.resultId,
            teamId,
            gradeConsent: false,
          },
        });
      }
    }

    for (let i = mdApprovedCount; i < mdApprovedCount + mdPendingCount && i < mdCandidates.length; i++) {
      const candidate = mdCandidates[i];
      const teamId = teamByKey.get(candidate.teamKey) || '';
      if (teamId) {
        const entry = await tx.entry.create({
          data: {
            eventId: mdEvent.id,
            status: 'pending_committee',
            forwardedAt: now,
          },
        });
        await tx.entryPlayer.create({
          data: {
            entryId: entry.id,
            userId: candidate.userId,
            eventId: mdEvent.id,
            gradeResultId: candidate.resultId,
            teamId,
            gradeConsent: false,
          },
        });
      }
    }

    // MS: 2 approved entries from members with grade S..N (7-10)
    const msCandidates = Array.from(userGradeMap.entries())
      .filter(([_, info]) => info.grade >= 7 && info.grade <= 10)
      .map(([userId, info]) => ({ userId, ...info }));

    for (let i = 0; i < 2 && i < msCandidates.length; i++) {
      const candidate = msCandidates[i];
      const teamId = teamByKey.get(candidate.teamKey) || '';
      if (teamId) {
        const entry = await tx.entry.create({
          data: {
            eventId: msEvent.id,
            status: 'approved',
            forwardedAt: now,
            decidedAt: now,
            decidedBy: adminId ?? null,
          },
        });
        await tx.entryPlayer.create({
          data: {
            entryId: entry.id,
            userId: candidate.userId,
            eventId: msEvent.id,
            gradeResultId: candidate.resultId,
            teamId,
            gradeConsent: false,
          },
        });
      }
    }

    // XD: no entries (shows empty event)

    return 1; // tournament created
  });

  // Check for draft tournament (idempotent)
  const existingDraft = await prisma.tournament.findFirst({
    where: { name: draftTournamentName },
  });

  let draftCreated = false;
  if (!existingDraft) {
    const draftStartsOn = new Date(`${today}T00:00:00Z`);
    draftStartsOn.setUTCDate(draftStartsOn.getUTCDate() + 60);

    const draftEntriesCloseAt = new Date(draftStartsOn);
    draftEntriesCloseAt.setUTCDate(draftEntriesCloseAt.getUTCDate() - 5);
    draftEntriesCloseAt.setUTCHours(10, 0, 0, 0);

    await prisma.$transaction(async (tx) => {
      const draftTournament = await tx.tournament.create({
        data: {
          name: draftTournamentName,
          venue: '',
          status: 'draft',
          startsOn: draftStartsOn,
          entriesCloseAt: draftEntriesCloseAt,
        },
      });

      await tx.event.create({
        data: {
          tournamentId: draftTournament.id,
          discipline: 'MD',
          gradeMinIndex: 6, // S-
          gradeMaxIndex: 8, // S+
          maxEntries: 16,
          minReviewers: 2,
        },
      });
    });

    draftCreated = true;
  }

  // 2027 tournament (idempotent by name)
  const tournament2027Name = 'ศึกแบดมินตันสงกรานต์สัมพันธ์ 2027';
  const existing2027 = await prisma.tournament.findFirst({
    where: { name: tournament2027Name },
  });

  let tournament2027Created = false;
  if (!existing2027) {
    const tournament2027StartsOn = new Date('2027-04-10T00:00:00Z');
    const tournament2027EntriesCloseAt = new Date('2027-04-03T10:00:00Z');

    const tournament2027Result = await prisma.$transaction(async (tx) => {
      const t2027 = await tx.tournament.create({
        data: {
          name: tournament2027Name,
          venue: 'สนามแบดมินตันเทศบาลนนทบุรี',
          status: 'open',
          startsOn: tournament2027StartsOn,
          entriesCloseAt: tournament2027EntriesCloseAt,
        },
      });

      // MD S..N event with 2 approved entries
      const mdEvent2027 = await tx.event.create({
        data: {
          tournamentId: t2027.id,
          discipline: 'MD',
          gradeMinIndex: 7, // S
          gradeMaxIndex: 10, // N
          maxEntries: 16,
          minReviewers: 2,
        },
      });

      // WS S-..S+ event with no entries
      await tx.event.create({
        data: {
          tournamentId: t2027.id,
          discipline: 'WS',
          gradeMinIndex: 6, // S-
          gradeMaxIndex: 8, // S+
          maxEntries: 12,
          minReviewers: 2,
        },
      });

      // MD entries: 2 approved from members with grade S..N (7-10)
      const mdCandidates2027 = Array.from(userGradeMap.entries())
        .filter(([_, info]) => info.grade >= 7 && info.grade <= 10)
        .map(([userId, info]) => ({ userId, ...info }));

      const now = new Date();
      for (let i = 0; i < 2 && i < mdCandidates2027.length; i++) {
        const candidate = mdCandidates2027[i];
        const teamId = teamByKey.get(candidate.teamKey) || '';
        if (teamId) {
          const entry = await tx.entry.create({
            data: {
              eventId: mdEvent2027.id,
              status: 'approved',
              forwardedAt: now,
              decidedAt: now,
              decidedBy: adminId ?? null,
            },
          });
          await tx.entryPlayer.create({
            data: {
              entryId: entry.id,
              userId: candidate.userId,
              eventId: mdEvent2027.id,
              gradeResultId: candidate.resultId,
              teamId,
              gradeConsent: false,
            },
          });
        }
      }

      return 1;
    });

    tournament2027Created = tournament2027Result > 0;
  }

  return { created: result + (tournament2027Created ? 1 : 0), draftCreated };
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

  // Create demo tournament (open and draft)
  const tourResult = await seedDemoTournament(admin?.id ?? null);
  const tournamentsMsg =
    tourResult.created > 0 || tourResult.draftCreated
      ? `tournaments: ${tourResult.created + (tourResult.draftCreated ? 1 : 0)} created`
      : 'tournaments: exists';

  return `demo: ok (committee + ${DEMO_MEMBERS.length} members, ${DEMO_TEAMS.length} teams${admin ? ', admin += Committee' : ''}, ${tournamentsMsg})`;
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
