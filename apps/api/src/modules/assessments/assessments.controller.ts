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
}
