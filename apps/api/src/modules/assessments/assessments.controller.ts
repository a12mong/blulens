import { Controller, Post, Body, Param, HttpCode } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { AssessmentsService } from './assessments.service';
import type { AuthUser } from '../../common/auth/auth.types';

const CreateAssessmentSchema = z.object({
  note: z.string().max(1000).optional(),
  eventId: z.string().uuid().optional(),
});

class CreateAssessmentDto extends createZodDto(CreateAssessmentSchema) {}

const AssignReviewersSchema = z.object({
  reviewerIds: z.array(z.string().uuid()).min(1).max(10).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'Duplicate reviewer IDs' }
  ),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

class AssignReviewersDto extends createZodDto(AssignReviewersSchema) {}

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @Roles('Member')
  async create(@Body() body: CreateAssessmentDto, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.create(user, body);
  }

  @Post(':assessmentId/submit')
  @HttpCode(200)
  @Roles('Member')
  async submit(@Param('assessmentId') assessmentId: string, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.submit(assessmentId, user);
  }

  @Post(':assessmentId/assign')
  @HttpCode(200)
  @Roles('Committee')
  async assign(
    @Param('assessmentId') assessmentId: string,
    @Body() body: AssignReviewersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.assign(assessmentId, user, body);
  }
}
