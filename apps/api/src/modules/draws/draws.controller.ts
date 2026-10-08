import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { DrawsService } from './draws.service';

const createGroupPreviewSchema = z.object({
  seed: z
    .string()
    .regex(/^[0-9a-f]{32}$/, 'seed must be 32 hex characters')
    .optional(),
  groupCount: z.number().int().min(1).optional(),
});

export class CreateGroupPreviewDto extends createZodDto(createGroupPreviewSchema) {}

const publishDrawSchema = z
  .object({
    acknowledgeConflicts: z.boolean().default(false),
    reason: z.string().optional(),
  })
  .default({});

export class PublishDrawDto extends createZodDto(publishDrawSchema) {}

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Roles('Committee', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @Post('events/:eventId/groups/preview')
  createGroupPreview(
    @Param('eventId', uuid) eventId: string,
    @Body() body: CreateGroupPreviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.draws.createGroupPreview(eventId, body, user);
  }

  @Roles('Committee', 'Admin')
  @HttpCode(HttpStatus.OK)
  @Post('draws/:drawId/publish')
  publishDraw(
    @Param('drawId', uuid) drawId: string,
    @Body() body: PublishDrawDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.draws.publishDraw(drawId, body, user);
  }
}
