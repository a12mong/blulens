import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { assertLocalDatabase, purgeQa } from '../prisma/purge-qa';

/** db:purge-qa (god decision 2026-10-07): scoped to this test's own zz-<uuid> prefix so it never touches other rows. */
const prisma = new PrismaClient();

describe('purge-qa script', () => {
  const prefix = `zz-${randomUUID().slice(0, 8)}`;
  const scope = { namePrefix: prefix, includeFarFuture: false };
  let userId = '';

  afterAll(async () => {
    const left = await prisma.tournament.findMany({ where: { name: { startsWith: prefix } }, select: { id: true } });
    const events = await prisma.event.findMany({ where: { tournamentId: { in: left.map((t) => t.id) } }, select: { id: true } });
    // also clean up after a failed assertion, when the purge never ran
    const byEvent = { eventId: { in: events.map((e) => e.id) } };
    await prisma.entry.deleteMany({ where: byEvent });
    await prisma.eventUmpire.deleteMany({ where: byEvent });
    await prisma.assessment.deleteMany({ where: byEvent });
    await prisma.event.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });
    await prisma.tournament.deleteMany({ where: { id: { in: left.map((t) => t.id) } } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('refuses a non-local database and a prefix outside zz-*', async () => {
    expect(() => assertLocalDatabase(undefined)).toThrow('DATABASE_URL');
    expect(() => assertLocalDatabase('postgresql://u:p@db.example.com:5432/blulens')).toThrow('not localhost');
    expect(() => assertLocalDatabase('postgresql://u:p@localhost:5442/blulens')).not.toThrow();
    expect(() => assertLocalDatabase('postgresql://u:p@127.0.0.1:5442/blulens')).not.toThrow();
    await expect(purgeQa(prisma, { namePrefix: 'Test', includeFarFuture: false }, false)).rejects.toThrow("'zz-'");
  });

  it('dry-runs by default, deletes only on apply, and keeps tournaments that have assessments', async () => {
    const user = await prisma.user.create({ data: { email: `${prefix}@purge.test`, passwordHash: 'x', displayName: 'purge test' } });
    userId = user.id;
    const mk = (name: string) =>
      prisma.tournament.create({
        data: {
          name: `${prefix} ${name}`, startsOn: new Date('2026-12-01'), entriesCloseAt: new Date('2026-11-25T10:00:00Z'),
          events: { create: { discipline: 'MD', gradeMinIndex: 6, gradeMaxIndex: 8 } },
        },
        include: { events: true },
      });
    const free = await mk('free');
    const held = await mk('held');
    await prisma.entry.create({ data: { eventId: free.events[0]!.id, status: 'pending_committee' } });
    await prisma.eventUmpire.create({ data: { eventId: free.events[0]!.id, userId: user.id } });
    await prisma.assessment.create({ data: { subjectUserId: user.id, eventId: held.events[0]!.id } });

    const dry = await purgeQa(prisma, scope, false);
    expect(dry).toEqual({
      applied: false, tournaments: 1, events: 1, entries: 1, entryPlayers: 0, eventUmpires: 1,
      blocked: [{ id: held.id, name: `${prefix} held` }],
    });
    expect(await prisma.tournament.count({ where: { name: { startsWith: prefix } } })).toBe(2);

    const real = await purgeQa(prisma, scope, true);
    expect(real).toMatchObject({ applied: true, tournaments: 1, events: 1, entries: 1, eventUmpires: 1 });
    expect(await prisma.tournament.findUnique({ where: { id: free.id } })).toBeNull();
    expect(await prisma.event.count({ where: { id: free.events[0]!.id } })).toBe(0);
    expect(await prisma.tournament.findUnique({ where: { id: held.id } })).not.toBeNull();

    // idempotent: a second run finds nothing left to delete
    expect(await purgeQa(prisma, scope, true)).toMatchObject({ tournaments: 0, events: 0, entries: 0 });
  });
});
