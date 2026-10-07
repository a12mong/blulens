import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { eventFormatSchema, eventInputSchema, tournamentInputSchema, tournamentStatusInputSchema } from '@blulens/shared';
import type { AuthUser, AuthedRequest } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { TournamentsService } from './tournaments.service';

class TournamentInputDto extends createZodDto(tournamentInputSchema) {}
class EventInputDto extends createZodDto(eventInputSchema) {}
class StatusInputDto extends createZodDto(tournamentStatusInputSchema) {}
class EventFormatDto extends createZodDto(eventFormatSchema) {}
class PageQueryDto extends createZodDto(
  z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

const uuid = new ParseUUIDPipe({ version: '4' });

/** openapi tag `tournaments` (bl-21 slice). Reads are public; Guest/Member never see draft tournaments. */
@Controller()
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Public()
  @Get('tournaments')
  list(@Query() q: PageQueryDto, @CurrentUser() user?: AuthUser) {
    return this.tournaments.list(user, q.cursor, q.limit);
  }

  @Roles('Committee')
  @Post('tournaments')
  create(@Body() body: TournamentInputDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.tournaments.create(body, user, req.ip);
  }

  @Public()
  @Get('tournaments/:tournamentId')
  detail(@Param('tournamentId', uuid) id: string, @CurrentUser() user?: AuthUser) {
    return this.tournaments.detail(id, user);
  }

  @Roles('Committee')
  @Post('tournaments/:tournamentId/status')
  @HttpCode(200)
  status(
    @Param('tournamentId', uuid) id: string,
    @Body() body: StatusInputDto,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ) {
    return this.tournaments.changeStatus(id, body.to, user, body.reason, req.ip);
  }

  @Public()
  @Get('tournaments/:tournamentId/events')
  events(@Param('tournamentId', uuid) id: string, @CurrentUser() user?: AuthUser) {
    return this.tournaments.events(id, user);
  }

  @Roles('Committee')
  @Post('tournaments/:tournamentId/events')
  createEvent(
    @Param('tournamentId', uuid) id: string,
    @Body() body: EventInputDto,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ) {
    return this.tournaments.createEvent(id, body, user, req.ip);
  }

  /** tournament-format §2: settings JSON, editable until the first group/knockout draw locks it. */
  @Roles('Committee')
  @Put('events/:eventId/format')
  setFormat(@Param('eventId', uuid) id: string, @Body() body: EventFormatDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.tournaments.setFormat(id, body, user, req.ip);
  }

  @Public()
  @Get('events/:eventId')
  eventDetail(@Param('eventId', uuid) id: string, @CurrentUser() user?: AuthUser) {
    return this.tournaments.eventDetail(id, user);
  }
}
