import { Controller, Get, Query } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { RaterStatsService } from './rater-stats.service';
import type { AuthUser } from '../../common/auth/auth.types';

const RaterStatsQuerySchema = z.object({
  window: z.enum(['30d', '90d', '365d', 'all']).default('90d'),
});

export class RaterStatsQueryDto extends createZodDto(RaterStatsQuerySchema) {}

@Controller('rater-stats')
export class RaterStatsController {
  constructor(private readonly service: RaterStatsService) {}

  @Get()
  @Roles('Committee', 'Reviewer')
  getRaterStats(@Query() query: RaterStatsQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.getRaterStats(query.window ?? '90d', user);
  }
}
