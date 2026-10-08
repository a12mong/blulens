import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { AssessmentsService } from './assessments.service';

const uuid = new ParseUUIDPipe({ version: '4' });

const CompleteClipSchema = z.object({
  durationSec: z.number().int().min(1),
});

class CompleteClipDto extends createZodDto(CompleteClipSchema) {}

/** Clip routes that are not nested under /assessments (presign flow step 3). */
@Controller('clips')
export class ClipsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post(':clipId/complete')
  @HttpCode(200)
  @Roles('Member')
  complete(@Param('clipId', uuid) clipId: string, @Body() body: CompleteClipDto, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.completeClip(clipId, body.durationSec, user);
  }
}
