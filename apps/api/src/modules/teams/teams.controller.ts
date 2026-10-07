import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { TeamsService } from './teams.service';

const SuggestQuerySchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

class SuggestQuery extends createZodDto(SuggestQuerySchema) {}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('suggest')
  @Roles('Member', 'Reviewer', 'Committee', 'Admin')
  async suggest(@Query() { q, limit }: SuggestQuery) {
    return this.teamsService.suggestTeamsByQuery(q, limit);
  }
}
