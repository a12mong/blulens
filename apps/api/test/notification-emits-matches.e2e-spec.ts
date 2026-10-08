import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('notification emits: matches N6-N8 and calibration N5 (bl-39-2b)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `notif-m-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  const u: Record<'committee' | 'umpire' | 'umpire2' | 'revA' | 'revB' | 'p1' | 'p2', string> = {
    committee: '',
    umpire: '',
    umpire2: '',
    revA: '',
    revB: '',
    p1: '',
    p2: '',
  };
  let eventId: string;
  let drawId: string;
  let entry1: string;
  let entry2: string;
  let matchNo = 1;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const committee = () => cookieFor(u.committee, ['Committee']);
  // knockout matches default to best of 3 to 21
  const games = [
    { a: 21, b: 10 },
    { a: 21, b: 12 },
  ];
  const notes = (userId: string, type: string) =>
    prisma.notification.findMany({
      where: { recipientUserId: userId, type },
      orderBy: { createdAt: 'asc' },
    });
  const newMatch = async () =>
    (
      await prisma.match.create({
        data: {
          eventId,
          drawId,
          stage: 'knockout',
          round: 9,
          matchNo: matchNo++,
          status: 'scheduled',
          topEntryId: entry1,
          bottomEntryId: entry2,
        },
      })
    ).id;
  const report = (matchId: string) =>
    http()
      .put(`/api/v1/matches/${matchId}/result`)
      .set('Cookie', cookieFor(u.umpire, ['Umpire']))
      .send({ outcome: 'played', games })
      .expect(200);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const roles = {
      committee: 'Committee',
      umpire: 'Umpire',
      umpire2: 'Umpire',
      revA: 'Reviewer',
      revB: 'Reviewer',
      p1: 'Member',
      p2: 'Member',
    } as const;
    for (const k of Object.keys(roles) as Array<keyof typeof roles>) {
      const user = await prisma.user.create({
        data: {
          email: `${tag}-${k}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} ${k}`,
          roles: { create: [{ role: roles[k] }] },
        },
      });
      u[k] = user.id;
      userIds.push(user.id);
    }

    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} T`,
        status: 'open',
        startsOn: new Date('2026-12-01T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-20T17:00:00Z'),
        createdBy: u.committee,
      },
    });
    eventId = (
      await prisma.event.create({
        data: {
          tournamentId: tournament.id,
          discipline: 'MS',
          gradeMinIndex: 0,
          gradeMaxIndex: 14,
          minReviewers: 2,
        },
      })
    ).id;
    for (const id of [u.umpire, u.umpire2]) {
      await prisma.eventUmpire.create({ data: { eventId, userId: id, courts: [] } });
    }
    const mkEntry = async (player: string, n: number) =>
      (
        await prisma.entry.create({
          data: {
            eventId,
            status: 'approved',
            name: `${tag} E${n}`,
            createdBy: u.committee,
            players: { create: [{ userId: player, eventId }] },
          },
        })
      ).id;
    entry1 = await mkEntry(u.p1, 1);
    entry2 = await mkEntry(u.p2, 2);
    drawId = (
      await prisma.draw.create({
        data: {
          eventId,
          kind: 'knockout',
          version: 1,
          status: 'published',
          seed: 's',
          seedSource: 'server',
          inputHash: '2'.repeat(64),
          snapshot: {},
          rulesetVersion: '1.0',
          prngId: 'pcg32',
          size: 2,
          seedsCount: 0,
          createdBy: u.committee,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('N6: umpire reports, Committee approves -> the umpire gets match_result_approved with the match link', async () => {
    const matchId = await newMatch();
    await report(matchId);
    expect(await notes(u.umpire, 'match_result_approved')).toHaveLength(0);
    await http()
      .post(`/api/v1/matches/${matchId}/result/approve`)
      .set('Cookie', committee())
      .expect(200);

    const [n, ...rest] = await notes(u.umpire, 'match_result_approved');
    expect(rest).toHaveLength(0);
    expect(n).toMatchObject({
      title: 'ผลแมตช์ที่คุณรายงานได้รับการยืนยันแล้ว',
      link: `/umpire/matches/${matchId}`,
    });
    expect(await prisma.notification.count({ where: { recipientUserId: u.committee } })).toBe(0);
  });

  it('N7: reject -> the reporting umpire (read before reportedBy is cleared) gets the reason as body', async () => {
    const matchId = await newMatch();
    await report(matchId);
    await http()
      .post(`/api/v1/matches/${matchId}/result/reject`)
      .set('Cookie', committee())
      .send({ reason: 'คะแนนเกมสองไม่ตรงใบบันทึก' })
      .expect(200);

    expect(
      (await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).reportedBy,
    ).toBeNull();
    const rejected = await notes(u.umpire, 'match_result_rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      body: 'คะแนนเกมสองไม่ตรงใบบันทึก',
      link: `/umpire/matches/${matchId}`,
    });
  });

  it('a result the Committee entered itself creates no notification', async () => {
    const before = await prisma.notification.count({ where: { recipientUserId: { in: userIds } } });
    const matchId = await newMatch();
    await http()
      .put(`/api/v1/matches/${matchId}/result`)
      .set('Cookie', committee())
      .send({ outcome: 'played', games })
      .expect(200);
    expect(await prisma.notification.count({ where: { recipientUserId: { in: userIds } } })).toBe(
      before,
    );
  });

  it('N8: assigning a new umpire notifies them once; re-sending the same umpire does not', async () => {
    const matchId = await newMatch();
    const patch = () =>
      http()
        .patch(`/api/v1/matches/${matchId}/assignment`)
        .set('Cookie', committee())
        .send({ umpireId: u.umpire2 })
        .expect(200);
    await patch();
    await patch();
    const assigned = await notes(u.umpire2, 'umpire_assigned');
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatchObject({
      title: 'คุณได้รับมอบหมายแมตช์ใหม่',
      link: `/umpire/matches/${matchId}`,
    });
  });

  it('N5 calibration: only reviewers that got NEW tasks are notified, blind text linking to /review', async () => {
    const set = await prisma.calibrationSet.create({
      data: { name: `${tag} cal`, createdBy: u.committee },
    });
    for (const i of [1, 2]) {
      await prisma.calibrationClip.create({
        data: {
          setId: set.id,
          objectKey: `/e2e/sample.mp4?c=${tag}-${i}`,
          referenceIndex: 7,
          status: 'uploaded',
        },
      });
    }
    const assign = (reviewerIds: string[]) =>
      http()
        .post(`/api/v1/calibration-sets/${set.id}/assign`)
        .set('Cookie', committee())
        .send({ reviewerIds })
        .expect(204);

    await assign([u.revA]);
    await assign([u.revA, u.revB]);

    const forA = await notes(u.revA, 'review_assigned');
    const forB = await notes(u.revB, 'review_assigned');
    expect(forA).toHaveLength(1);
    expect(forB).toHaveLength(1);
    for (const n of [...forA, ...forB]) {
      expect(n).toMatchObject({ title: 'มีงานประเมินใหม่ 2 งาน', body: null, link: '/review' });
      expect(`${n.title}${n.body ?? ''}${n.link}`).not.toMatch(
        new RegExp(`${set.id}|${tag}|calibration|ปรับมาตรฐาน`),
      );
    }
  });
});
