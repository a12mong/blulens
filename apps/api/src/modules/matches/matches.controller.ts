import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { MatchesService } from './matches.service';

const eventMatchesQuerySchema = z.object({
  status: z.enum(['scheduled', 'bye', 'reported', 'confirmed', 'walkover', 'void']).optional(),
  stage: z.enum(['group', 'knockout', 'third_place']).optional(),
  round: z.coerce.number().int().min(1).optional(),
});

export class EventMatchesQueryDto extends createZodDto(eventMatchesQuerySchema) {}

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Public()
  @Get('events/:eventId/matches')
  getEventMatches(
    @Param('eventId', uuid) eventId: string,
    @Query() query: EventMatchesQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.matches.getEventMatches(eventId, query, user);
  }
}
