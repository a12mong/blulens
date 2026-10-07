/**
 * One-time purge of QA/smoke data from a LOCAL dev database (god decision 2026-10-07).
 * Scope: tournaments named 'zz-*' or starting on/after 2099-01-01, with their events, entries (+ entry players)
 * and event umpires. Nothing else. Audit rows are never touched.
 * A tournament whose events have assessments, draws, groups or matches is reported as blocked and kept
 * (those rows sit behind append-only triggers; this script never disables a trigger).
 *
 * Run: pnpm db:purge-qa          dry run: prints counts per table, changes nothing
 *      pnpm db:purge-qa --yes    deletes, in one transaction
 */
import { Prisma, PrismaClient } from '@prisma/client';

export interface PurgeScope {
  /** Tournament name prefix. The CLI always uses 'zz-'; tests narrow it to their own unique prefix. */
  namePrefix: string;
  /** Also match tournaments starting on/after 2099-01-01 (Playwright smoke runs). */
  includeFarFuture: boolean;
}

export interface PurgeReport {
  applied: boolean;
  tournaments: number;
  events: number;
  entries: number;
  entryPlayers: number;
  eventUmpires: number;
  /** Matching tournaments kept because their events have assessments / draws / groups / matches. */
  blocked: { id: string; name: string }[];
}

export const CLI_SCOPE: PurgeScope = { namePrefix: 'zz-', includeFarFuture: true };
const FAR_FUTURE = new Date('2099-01-01T00:00:00Z');

/** Refuse anything but a database on this machine. */
export function assertLocalDatabase(url: string | undefined): void {
  if (!url) throw new Error('DATABASE_URL is not set');
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`refusing to purge: database host '${host}' is not localhost`);
  }
}

export async function purgeQa(prisma: PrismaClient, scope: PurgeScope, apply: boolean): Promise<PurgeReport> {
  if (!scope.namePrefix.startsWith('zz-')) throw new Error("namePrefix must start with 'zz-'");
  return prisma.$transaction(
    async (tx) => {
      const matched = await tx.tournament.findMany({
        where: {
          OR: [
            { name: { startsWith: scope.namePrefix } },
            ...(scope.includeFarFuture ? [{ startsOn: { gte: FAR_FUTURE } }] : []),
          ],
        },
        select: { id: true, name: true, events: { select: { id: true } } },
      });

      const blocked: PurgeReport['blocked'] = [];
      const tournamentIds: string[] = [];
      const eventIds: string[] = [];
      for (const t of matched) {
        const ids = t.events.map((e) => e.id);
        const where = { eventId: { in: ids } };
        const [a, d, g, m] = await Promise.all([
          tx.assessment.count({ where }),
          tx.draw.count({ where }),
          tx.group.count({ where }),
          tx.match.count({ where }),
        ]);
        if (a + d + g + m > 0) {
          blocked.push({ id: t.id, name: t.name });
          continue;
        }
        tournamentIds.push(t.id);
        eventIds.push(...ids);
      }

      const byEvent = { eventId: { in: eventIds } };
      const report: PurgeReport = {
        applied: apply,
        tournaments: tournamentIds.length,
        events: eventIds.length,
        entries: await tx.entry.count({ where: byEvent }),
        entryPlayers: await tx.entryPlayer.count({ where: byEvent }),
        eventUmpires: await tx.eventUmpire.count({ where: byEvent }),
        blocked,
      };
      if (!apply) return report;

      // children first; entry_players and event_umpires would cascade, but explicit deletes keep the counts honest
      await tx.entryPlayer.deleteMany({ where: byEvent });
      await tx.entry.deleteMany({ where: byEvent });
      await tx.eventUmpire.deleteMany({ where: byEvent });
      await tx.event.deleteMany({ where: { id: { in: eventIds } } });
      await tx.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
      return report;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
  );
}

async function main() {
  const apply = process.argv.includes('--yes');
  assertLocalDatabase(process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const r = await purgeQa(prisma, CLI_SCOPE, apply);
    console.log(apply ? 'purge-qa: DELETED' : 'purge-qa: DRY RUN (nothing changed; re-run with --yes to delete)');
    console.log(`  tournaments   ${r.tournaments}`);
    console.log(`  events        ${r.events}`);
    console.log(`  entries       ${r.entries}`);
    console.log(`  entry_players ${r.entryPlayers}`);
    console.log(`  event_umpires ${r.eventUmpires}`);
    console.log(`  blocked (kept: assessments/draws/groups/matches) ${r.blocked.length}`);
    for (const b of r.blocked) console.log(`    - ${b.id} ${b.name}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
