import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { suggestTeams, type TeamNameCandidate, type TeamSuggestion } from '@blulens/shared';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async suggestTeamsByQuery(query: string, limit: number): Promise<TeamSuggestion[]> {
    // Fetch all active teams with their name keys
    const teams = await this.prisma.team.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, nameKey: true },
    });

    // Fetch all aliases of active teams
    const aliases = await this.prisma.teamAlias.findMany({
      where: { team: { status: 'active' } },
      select: { teamId: true, alias: true, aliasKey: true },
    });

    // Build candidates array: team names + aliases
    const candidates: TeamNameCandidate[] = [];

    // Add team names
    for (const team of teams) {
      candidates.push({
        teamId: team.id,
        name: team.name,
        alias: null,
        key: team.nameKey,
      });
    }

    // Add aliases
    for (const alias of aliases) {
      const team = teams.find((t: typeof teams[0]) => t.id === alias.teamId);
      if (team) {
        candidates.push({
          teamId: alias.teamId,
          name: team.name,
          alias: alias.alias,
          key: alias.aliasKey,
        });
      }
    }

    // Use pure suggestTeams function
    return suggestTeams(query, candidates, limit);
  }
}
