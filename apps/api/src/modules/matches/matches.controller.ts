import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { reasonInputSchema } from '@blulens/shared';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { MatchesService } from './matches.service';

const eventMatchesQuerySchema = z.object({
  status: z.enum(['scheduled', 'bye', 'reported', 'confirmed', 'walkover', 'void']).optional(),
  stage: z.enum(['group', 'knockout', 'third_place']).optional(),
  round: z.coerce.number().int().min(1).optional(),
});

export class EventMatchesQueryDto extends createZodDto(eventMatchesQuerySchema) {}

const eventGroupsQuerySchema = z.object({
  draw: z.enum(['published', 'preview']).optional(),
});

export class EventGroupsQueryDto extends createZodDto(eventGroupsQuerySchema) {}

const putMatchResultSchema = z.object({
  outcome: z.enum(['played', 'walkover_a', 'walkover_b']),
  games: z
    .array(
      z.object({
        a: z.number().int().min(0),
        b: z.number().int().min(0),
      }),
    )
    .optional(),
  reason: z.string().optional(),
});

export class PutMatchResultDto extends createZodDto(putMatchResultSchema) {}

export class RejectMatchResultDto extends createZodDto(reasonInputSchema) {}

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

  @Public()
  @Get('events/:eventId/standings')
  getEventStandings(@Param('eventId', uuid) eventId: string, @CurrentUser() user?: AuthUser) {
    return this.matches.getEventStandings(eventId, user);
  }

  @Public()
  @Get('events/:eventId/groups')
  getEventGroups(
    @Param('eventId', uuid) eventId: string,
    @Query() query: EventGroupsQueryDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.matches.getEventGroups(eventId, query, user);
  }

  @Roles('Committee', 'Admin')
  @HttpCode(HttpStatus.OK)
  @Post('events/:eventId/groups/confirm')
  confirmEventGroups(@Param('eventId', uuid) eventId: string, @CurrentUser() user: AuthUser) {
    return this.matches.confirmEventGroups(eventId, user);
  }

  @Roles('Umpire', 'Committee', 'Admin')
  @Put('matches/:matchId/result')
  putMatchResult(
    @Param('matchId', uuid) matchId: string,
    @Body() body: PutMatchResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matches.putMatchResult(matchId, body, user);
  }

  @Roles('Committee', 'Admin')
  @HttpCode(HttpStatus.OK)
  @Post('matches/:matchId/result/approve')
  approveMatchResult(@Param('matchId', uuid) matchId: string, @CurrentUser() user: AuthUser) {
    return this.matches.approveMatchResult(matchId, user);
  }

  @Roles('Committee', 'Admin')
  @HttpCode(HttpStatus.OK)
  @Post('matches/:matchId/result/reject')
  rejectMatchResult(
    @Param('matchId', uuid) matchId: string,
    @Body() body: RejectMatchResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matches.rejectMatchResult(matchId, body.reason, user);
  }
}
