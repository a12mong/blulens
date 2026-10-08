import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { MatchesService } from './matches.service';

const umpireMatchesQuerySchema = z.object({
  status: z.enum(['scheduled', 'reported', 'confirmed']).optional(),
});

export class UmpireMatchesQueryDto extends createZodDto(umpireMatchesQuerySchema) {}

@Controller()
export class UmpireController {
  constructor(private readonly matches: MatchesService) {}

  @Roles('Umpire')
  @Get('umpire/matches')
  getUmpireMatches(@Query() query: UmpireMatchesQueryDto, @CurrentUser() user: AuthUser) {
    return this.matches.getUmpireMatches(query, user);
  }
}
