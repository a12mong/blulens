/**
 * Idempotent seed (bl-07): bootstrap Admin from env + the active grading-v1 rubric.
 * Roles are a fixed enum (A2), so there is nothing to seed for them.
 * Run: pnpm db:seed   (reads ../../.env; SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 */
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto/password';
import {
  DRAW_PRNG_ID,
  DRAW_RULESET_VERSION,
  eventFormatSchema,
  normalizeTeamName,
  planGroups,
  roundRobinSchedule,
  validateMatchScore,
  type DrawEntry,
  type EventFormat,
  type MatchFormat,
} from '@blulens/shared';

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
  const existing = await prisma.rubric.findUnique({
    where: { methodVersion: GRADING_V1.methodVersion },
  });
  if (existing) return 'rubric grading-v1: exists';
  const anyActive = await prisma.rubric.findFirst({ where: { active: true } });
  // the baseline is never an editor draft (rubrics_one_draft): activatedAt is always set
  await prisma.rubric.create({ data: { ...GRADING_V1, active: !anyActive, activatedAt: new Date() } });
  return `rubric grading-v1: created (active=${!anyActive})`;
}

// ---------------------------------------------------------------- demo data (dev only: SEED_DEMO=1)

const GRADE_KEYS = [
  'RK1',
  'RK2',
  'RK3',
  'BG1',
  'BG2',
  'BG3',
  'S-',
  'S',
  'S+',
  'N-',
  'N',
  'N+',
  'P-',
  'P',
  'P+',
];

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

async function upsertUser(
  email: string,
  displayName: string,
  password: string,
  roles: Array<'Admin' | 'Committee' | 'Member' | 'Reviewer' | 'Umpire'>,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing ??
    (await prisma.user.create({
      data: { email, displayName, passwordHash: await hashPassword(password) },
    }));
  for (const role of roles) {
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      create: { userId: user.id, role },
      update: {},
    });
  }
  return user;
}

type DemoCandidate = { userId: string; grade: number; resultId: string; teamKey: string };

/** One demo entry with its players: 1 for singles, 2 for doubles. Skipped if a player's club is unknown. */
async function createDemoEntry(
  tx: Prisma.TransactionClient,
  eventId: string,
  players: DemoCandidate[],
  teamByKey: Map<string, string>,
  status: 'approved' | 'pending_committee',
  adminId: string | null,
  now: Date,
) {
  const rows = players.map((c) => ({ c, teamId: teamByKey.get(c.teamKey) }));
  if (rows.some((r) => !r.teamId)) return;
  await tx.entry.create({
    data: {
      eventId,
      status,
      forwardedAt: now,
      ...(status === 'approved' ? { decidedAt: now, decidedBy: adminId } : {}),
      players: {
        create: rows.map(({ c, teamId }) => ({
          userId: c.userId,
          eventId,
          gradeResultId: c.resultId,
          teamId,
          gradeConsent: false,
        })),
      },
    },
  });
}

/** Candidates whose grade index lies in [min, max], in seed order. */
const inBand = (
  map: Map<string, Omit<DemoCandidate, 'userId'>>,
  min: number,
  max: number,
): DemoCandidate[] =>
  [...map.entries()]
    .filter(([, i]) => i.grade >= min && i.grade <= max)
    .map(([userId, i]) => ({ userId, ...i }));

async function seedDemoTournament(
  adminId: string | null,
): Promise<{ created: number; draftCreated: boolean }> {
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
      const [result] = assessmentWithResult.results;
      if (result && result.lowerIndex !== null) {
        const teamKey = memberDef.teams[0] ?? '';
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
    const eventFormatData: EventFormat = eventFormatSchema.parse({
      type: 'groups_knockout',
      groupSize: 4,
      advancePerGroup: 2,
      bestThirds: 0,
    });

    const mdEvent = await tx.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MD',
        gradeMinIndex: 6, // S-
        gradeMaxIndex: 8, // S+
        maxEntries: 16,
        minReviewers: 2,
        format: eventFormatData,
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

    // MD (doubles, 2 players each): 3 approved + 2 pending pairs from S-..S+ players
    const md = inBand(userGradeMap, 6, 8);
    for (let i = 0; i < 5 && 2 * i + 1 < md.length; i++) {
      await createDemoEntry(
        tx,
        mdEvent.id,
        [md[2 * i]!, md[2 * i + 1]!],
        teamByKey,
        i < 3 ? 'approved' : 'pending_committee',
        adminId,
        now,
      );
    }

    // MS (singles): 2 approved from S..N players
    const ms = inBand(userGradeMap, 7, 10);
    for (let i = 0; i < 2 && i < ms.length; i++) {
      await createDemoEntry(tx, msEvent.id, [ms[i]!], teamByKey, 'approved', adminId, now);
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

      // MD (doubles): 2 approved pairs from S..N players
      const md2027 = inBand(userGradeMap, 7, 10);
      const now = new Date();
      for (let i = 0; i < 2 && 2 * i + 1 < md2027.length; i++) {
        await createDemoEntry(
          tx,
          mdEvent2027.id,
          [md2027[2 * i]!, md2027[2 * i + 1]!],
          teamByKey,
          'approved',
          adminId,
          now,
        );
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

  const reviewers = [
    await upsertUser('reviewer1@blulens.local', 'ผู้ตรวจ 1', password, ['Reviewer']),
    await upsertUser('reviewer2@blulens.local', 'ผู้ตรวจ 2', password, ['Reviewer']),
    await upsertUser('reviewer3@blulens.local', 'ผู้ตรวจ 3', password, ['Reviewer']),
  ];

  const umpire1 = await upsertUser('umpire1@blulens.local', 'กรรมการ 1', password, ['Umpire']);

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
      const open = await prisma.teamMembership.findFirst({
        where: { userId: user.id, teamId, validTo: null },
      });
      if (!open) await prisma.teamMembership.create({ data: { userId: user.id, teamId } });
    }
    // D-S3: an official grade so entries pass the grade checks (an override result: margin 0, exact)
    const graded = await prisma.assessmentResult.findFirst({
      where: { status: { in: ['approved', 'overridden'] }, assessment: { subjectUserId: user.id } },
    });
    if (!graded) {
      const assessment = await prisma.assessment.create({
        data: {
          subjectUserId: user.id,
          rubricId: rubric?.id,
          status: 'overridden',
          submittedAt: new Date(),
        },
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

  // Create demo reviews (open review queue for reviewer1 & reviewer2)
  const reviewsMsg = await seedDemoReviews(admin?.id ?? null, reviewers);
  console.log(reviewsMsg);

  // Create demo tournament (open and draft)
  const tourResult = await seedDemoTournament(admin?.id ?? null);
  const tournamentsMsg =
    tourResult.created > 0 || tourResult.draftCreated
      ? `tournaments: ${tourResult.created + (tourResult.draftCreated ? 1 : 0)} created`
      : 'tournaments: exists';

  // Set demo event format (before group stage)
  const eventFormatMsg = await seedDemoEventFormat();
  console.log(eventFormatMsg);

  // Create demo group stage (published group stage with matches)
  const groupStageMsg = await seedDemoGroupStage(admin?.id ?? null);
  console.log(groupStageMsg);

  // Create demo umpire for group stage
  const umpireMsg = await seedDemoUmpire(umpire1.id);
  console.log(umpireMsg);

  return `demo: ok (committee + 3 reviewers + ${DEMO_MEMBERS.length} members + umpire1, ${DEMO_TEAMS.length} teams${admin ? ', admin += Committee' : ''}, ${tournamentsMsg}, ${reviewsMsg}, ${eventFormatMsg}, ${groupStageMsg}, ${umpireMsg})`;
}

async function seedDemoReviews(
  adminId: string | null,
  reviewers: Array<{ id: string; email: string }>,
): Promise<string> {
  const activeRubric =
    (await prisma.rubric.findFirst({ where: { active: true } })) ??
    (await prisma.rubric.findUnique({ where: { methodVersion: 'grading-v1' } }));

  const subjectEmails = ['member7@blulens.local', 'member8@blulens.local'];
  let created = 0;

  for (const email of subjectEmails) {
    const subject = await prisma.user.findUnique({ where: { email } });
    if (!subject) continue;

    // Idempotency marker: an Assessment with note 'demo-seed: review queue' for that subject
    const existing = await prisma.assessment.findFirst({
      where: {
        subjectUserId: subject.id,
        note: 'demo-seed: review queue',
      },
    });
    if (existing) continue;

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const dueAt = new Date(now.getTime() + 48 * 3600 * 1000);

      const assessment = await tx.assessment.create({
        data: {
          subjectUserId: subject.id,
          rubricId: activeRubric?.id,
          status: 'in_review',
          submittedAt: now,
          note: 'demo-seed: review queue',
        },
      });

      const clipId = randomUUID();
      await tx.clip.create({
        data: {
          id: clipId,
          assessmentId: assessment.id,
          objectKey: `/e2e/sample.mp4?c=${clipId}`,
          status: 'uploaded',
          contentType: 'video/mp4',
          durationSec: 4,
        },
      });

      await tx.assessmentTransition.create({
        data: {
          assessmentId: assessment.id,
          fromStatus: 'draft',
          toStatus: 'submitted',
          actorId: null,
          reason: 'demo seed',
          createdAt: now,
        },
      });

      await tx.assessmentTransition.create({
        data: {
          assessmentId: assessment.id,
          fromStatus: 'submitted',
          toStatus: 'in_review',
          actorId: null,
          reason: 'demo seed',
          createdAt: now,
        },
      });

      // open ReviewAssignments for reviewer1 and reviewer2 (dueAt now + 48h, assignedBy admin id or null)
      // Never assign a reviewer to an assessment of themselves.
      const assignedReviewers = [reviewers[0]!, reviewers[1]!].filter((r) => r.id !== subject.id);
      for (const rev of assignedReviewers) {
        await tx.reviewAssignment.create({
          data: {
            kind: 'assessment',
            assessmentId: assessment.id,
            reviewerId: rev.id,
            state: 'open',
            dueAt,
            assignedBy: adminId,
          },
        });
      }
    });

    created++;
  }

  return created > 0 ? `demo reviews: ${created} created` : 'demo reviews: exists';
}

async function seedDemoEventFormat(): Promise<string> {
  const tournamentName = 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3';
  const tournament = await prisma.tournament.findFirst({
    where: { name: tournamentName },
    include: {
      events: {
        where: { discipline: 'MD' },
      },
    },
  });

  if (!tournament || tournament.events.length === 0) {
    return 'demo event format: no event';
  }

  const mdEvent = tournament.events[0]!;

  // Never overwrite if format is already set (god-approved exception for idempotency)
  if (mdEvent.format !== null) {
    return 'demo event format: exists';
  }

  const eventFormatData: EventFormat = eventFormatSchema.parse({
    type: 'groups_knockout',
    groupSize: 4,
    advancePerGroup: 2,
    bestThirds: 0,
  });

  await prisma.event.update({
    where: { id: mdEvent.id },
    data: { format: eventFormatData },
  });

  return 'demo event format: set';
}

async function seedDemoGroupStage(adminId: string | null): Promise<string> {
  if (!adminId) {
    return 'demo group stage: skipped (no admin)';
  }

  const tournamentName = 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3';
  const tournament = await prisma.tournament.findFirst({
    where: { name: tournamentName },
    include: {
      events: {
        where: { discipline: 'MD' },
      },
    },
  });

  if (!tournament || tournament.events.length === 0) {
    return 'demo group stage: skipped (tournament or MD event not found)';
  }

  const mdEvent = tournament.events[0]!;

  // Idempotency marker: any Draw with kind 'group' for that MD event
  const existingDraw = await prisma.draw.findFirst({
    where: {
      eventId: mdEvent.id,
      kind: 'group',
    },
  });

  if (existingDraw) {
    return 'demo group stage: exists';
  }

  // Use ONLY approved entries. If fewer than 3 are approved, skip with a log line.
  const approvedEntries = await prisma.entry.findMany({
    where: {
      eventId: mdEvent.id,
      status: 'approved',
    },
    include: {
      players: {
        include: {
          gradeResult: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  if (approvedEntries.length < 3) {
    return 'demo group stage: skipped (fewer than 3 approved entries)';
  }

  const group2x15Format: MatchFormat = {
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    drawAllowed: true,
  };

  const firstScoreCheck = validateMatchScore(
    [
      [15, 11],
      [15, 9],
    ],
    group2x15Format,
  );
  if (!firstScoreCheck.ok) {
    throw new Error(`First match score invalid: ${firstScoreCheck.message}`);
  }

  const secondScoreCheck = validateMatchScore(
    [
      [13, 15],
      [15, 12],
    ],
    group2x15Format,
  );
  if (!secondScoreCheck.ok) {
    throw new Error(`Second match score invalid: ${secondScoreCheck.message}`);
  }

  const drawEntries: DrawEntry[] = approvedEntries.map((e) => {
    const teamIds = Array.from(
      new Set(
        e.players
          .map((p) => p.teamId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const scores = e.players
      .map((p) => (p.gradeResult?.score != null ? Number(p.gradeResult.score) : null))
      .filter((s): s is number => typeof s === 'number');
    const seedScore =
      scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

    return {
      id: e.id,
      teamIds,
      seedScore,
    };
  });

  const plan = planGroups(drawEntries, 4, 'demo-seed');
  if ('error' in plan) {
    throw new Error(`planGroups failed: ${plan.error}`);
  }

  const sortedEntryIds = approvedEntries.map((e) => e.id).sort();
  const inputHash = createHash('sha256').update(sortedEntryIds.join(',')).digest('hex');

  const now = new Date();
  let totalMatches = 0;

  await prisma.$transaction(async (tx) => {
    const draw = await tx.draw.create({
      data: {
        eventId: mdEvent.id,
        kind: 'group',
        version: 1,
        status: 'published',
        seed: 'demo-seed',
        seedSource: 'server',
        inputHash,
        snapshot: {
          entries: drawEntries.map((d) => ({
            id: d.id,
            teamIds: [...d.teamIds],
            seedScore: d.seedScore,
          })),
        } as Prisma.InputJsonObject,
        rulesetVersion: DRAW_RULESET_VERSION,
        prngId: DRAW_PRNG_ID,
        size: drawEntries.length,
        seedsCount: 0,
        createdBy: adminId,
      },
    });

    let globalMatchNo = 1;

    for (let i = 0; i < plan.groups.length; i++) {
      const groupEntries = plan.groups[i]!;
      const label = String.fromCharCode(65 + i);

      const group = await tx.group.create({
        data: {
          eventId: mdEvent.id,
          drawId: draw.id,
          label,
        },
      });

      for (let j = 0; j < groupEntries.length; j++) {
        const entryId = groupEntries[j]!;
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            entryId,
            seedInGroup: j + 1,
            pot: j + 1,
          },
        });
      }

      const schedule = roundRobinSchedule(groupEntries.length);
      for (const roundItem of schedule) {
        for (const [posA, posB] of roundItem.matches) {
          const topEntryId = groupEntries[posA - 1]!;
          const bottomEntryId = groupEntries[posB - 1]!;
          const matchIndex = totalMatches;
          totalMatches++;
          const matchNo = globalMatchNo++;

          if (matchIndex === 0) {
            await tx.match.create({
              data: {
                eventId: mdEvent.id,
                drawId: draw.id,
                groupId: group.id,
                stage: 'group',
                round: roundItem.round,
                matchNo,
                court: 'สนาม 1',
                topEntryId,
                bottomEntryId,
                games: [
                  { a: 15, b: 11 },
                  { a: 15, b: 9 },
                ],
                result: 'a_win',
                winnerEntryId: topEntryId,
                status: 'confirmed',
                confirmedBy: adminId,
                confirmedAt: now,
                resultVersion: 1,
                flags: [],
              },
            });
          } else if (matchIndex === 1) {
            await tx.match.create({
              data: {
                eventId: mdEvent.id,
                drawId: draw.id,
                groupId: group.id,
                stage: 'group',
                round: roundItem.round,
                matchNo,
                court: 'สนาม 1',
                topEntryId,
                bottomEntryId,
                games: [
                  { a: 13, b: 15 },
                  { a: 15, b: 12 },
                ],
                result: 'draw',
                status: 'reported',
                reportedBy: adminId,
                reportedAt: now,
                resultVersion: 0,
                flags: [],
              },
            });
          } else {
            await tx.match.create({
              data: {
                eventId: mdEvent.id,
                drawId: draw.id,
                groupId: group.id,
                stage: 'group',
                round: roundItem.round,
                matchNo,
                court: 'สนาม 1',
                topEntryId,
                bottomEntryId,
                status: 'scheduled',
                resultVersion: 0,
                flags: [],
              },
            });
          }
        }
      }
    }
  });

  return `demo group stage: created (${plan.groups.length} groups, ${totalMatches} matches)`;
}

async function seedDemoUmpire(umpireId: string): Promise<string> {
  const tournamentName = 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3';
  const tournament = await prisma.tournament.findFirst({
    where: { name: tournamentName },
    include: {
      events: {
        where: { discipline: 'MD' },
      },
    },
  });

  if (!tournament || tournament.events.length === 0) {
    return 'demo umpire: no event';
  }

  const mdEvent = tournament.events[0]!;

  const existingUmpire = await prisma.eventUmpire.findFirst({
    where: {
      eventId: mdEvent.id,
      userId: umpireId,
    },
  });

  if (existingUmpire) {
    return 'demo umpire: exists';
  }

  await prisma.eventUmpire.create({
    data: {
      eventId: mdEvent.id,
      userId: umpireId,
      courts: [],
    },
  });

  return 'demo umpire: created';
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
