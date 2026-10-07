import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { entryApproveInputSchema, entryInputSchema, entryStatusSchema, reasonInputSchema } from '@blulens/shared';
import type { AuthUser, AuthedRequest } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { EntriesService } from './entries.service';

class EntryInputDto extends createZodDto(entryInputSchema) {}
// body is optional (Dwight N1): no body = approve without a reason
class ApproveDto extends createZodDto(entryApproveInputSchema.default({})) {}
class ReasonDto extends createZodDto(reasonInputSchema) {}
class EventEntriesQueryDto extends createZodDto(z.object({ status: entryStatusSchema.optional() })) {}
class QueueQueryDto extends createZodDto(
  z.object({
    status: entryStatusSchema.optional(),
    eventId: z.string().uuid().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

const uuid = new ParseUUIDPipe({ version: '4' });

/** architecture §6.10 / openapi (bl-21 slice). Member self-registration is out of slice 1. */
@Controller()
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Roles('Admin', 'Committee')
  @Post('events/:eventId/entries')
  create(@Param('eventId', uuid) eventId: string, @Body() body: EntryInputDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.entries.create(eventId, body, user, req.ip);
  }

  @Public()
  @Get('events/:eventId/entries')
  list(@Param('eventId', uuid) eventId: string, @Query() q: EventEntriesQueryDto, @CurrentUser() user?: AuthUser) {
    return this.entries.listForEvent(eventId, q.status, user);
  }

  @Roles('Committee', 'Admin')
  @Get('entries')
  queue(@Query() q: QueueQueryDto, @CurrentUser() user: AuthUser) {
    return this.entries.queue(q.status, q.eventId, q.cursor, q.limit, user);
  }

  @Roles('Admin', 'Committee')
  @Post('entries/:entryId/forward')
  @HttpCode(200)
  forward(@Param('entryId', uuid) id: string, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.entries.forward(id, user, req.ip);
  }

  @Roles('Committee')
  @Post('entries/:entryId/approve')
  @HttpCode(200)
  approve(@Param('entryId', uuid) id: string, @Body() body: ApproveDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.entries.approve(id, body.reason, user, req.ip);
  }

  @Roles('Committee')
  @Post('entries/:entryId/reject')
  @HttpCode(200)
  reject(@Param('entryId', uuid) id: string, @Body() body: ReasonDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.entries.reject(id, body.reason, user, req.ip);
  }
}
