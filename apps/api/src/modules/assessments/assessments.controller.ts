import { Controller, Post, Get, Body, Param, Query, HttpCode, ParseUUIDPipe } from '@nestjs/common';
import { AssessmentStatus } from '@prisma/client';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { GRADES } from '@blulens/shared';
import { CLIP_CONTENT_TYPES, CLIP_MAX_BYTES } from '../../common/storage/storage.service';
import { AssessmentsService } from './assessments.service';
import type { AuthUser } from '../../common/auth/auth.types';

const sortPattern = /^(createdAt|updatedAt|status):(asc|desc)$/;

const ListAssessmentsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(AssessmentStatus).optional(),
  subjectUserId: z.string().uuid().optional(),
  sort: z
    .string()
    .regex(sortPattern, { message: 'Invalid sort parameter' })
    .default('createdAt:desc'),
});

export class ListAssessmentsQueryDto extends createZodDto(ListAssessmentsQuerySchema) {}

const uuid = new ParseUUIDPipe({ version: '4' });

const CreateAssessmentSchema = z.object({
  note: z.string().max(1000).optional(),
  eventId: z.string().uuid().optional(),
});

class CreateAssessmentDto extends createZodDto(CreateAssessmentSchema) {}

const AssignReviewersSchema = z.object({
  reviewerIds: z
    .array(z.string().uuid())
    .min(1)
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate reviewer IDs' }),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

class AssignReviewersDto extends createZodDto(AssignReviewersSchema) {}

const ApproveAssessmentSchema = z
  .object({
    resultVersion: z.number().int().optional(),
    note: z.string().max(1000).optional(),
  })
  .optional()
  .default({});

class ApproveAssessmentDto extends createZodDto(ApproveAssessmentSchema) {}

const ReturnAssessmentSchema = z
  .object({
    reason: z.string().optional(),
    resultVersion: z.number().int().optional(),
  })
  .optional()
  .default({});

class ReturnAssessmentDto extends createZodDto(ReturnAssessmentSchema) {}

const ConfirmAssessmentSchema = z
  .object({
    resultVersion: z.number().int().optional(),
    note: z.string().max(1000).optional(),
  })
  .optional()
  .default({});

class ConfirmAssessmentDto extends createZodDto(ConfirmAssessmentSchema) {}

const OverrideAssessmentSchema = z.object({
  centerKey: z.enum(GRADES),
  reason: z.string().optional(),
  resultVersion: z.number().int().optional(),
});

class OverrideAssessmentDto extends createZodDto(OverrideAssessmentSchema) {}

const UploadClipUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(CLIP_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(CLIP_MAX_BYTES),
});

class UploadClipUrlDto extends createZodDto(UploadClipUrlSchema) {}

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  @Roles('Member', 'Committee', 'Admin')
  async list(@Query() query: ListAssessmentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.list(user, query);
  }

  @Get(':assessmentId')
  @Roles('Member', 'Committee', 'Admin')
  async getDetail(
    @Param('assessmentId', uuid) assessmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.getDetail(assessmentId, user);
  }

  @Post()
  @Roles('Member')
  async create(@Body() body: CreateAssessmentDto, @CurrentUser() user: AuthUser) {
    return this.assessmentsService.create(user, body);
  }

  @Post(':assessmentId/clips/upload-url')
  @HttpCode(200)
  @Roles('Member')
  async getClipUploadUrl(
    @Param('assessmentId', uuid) assessmentId: string,
    @Body() body: UploadClipUrlDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.getClipUploadUrl(assessmentId, body, user);
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

  @Post(':assessmentId/approve')
  @HttpCode(200)
  @Roles('Committee')
  async approve(
    @Param('assessmentId', uuid) assessmentId: string,
    @Body() body: ApproveAssessmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.approve(assessmentId, user, body);
  }

  @Post(':assessmentId/return')
  @HttpCode(200)
  @Roles('Committee')
  async return(
    @Param('assessmentId', uuid) assessmentId: string,
    @Body() body: ReturnAssessmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.return(assessmentId, user, body);
  }

  @Post(':assessmentId/confirm')
  @HttpCode(200)
  @Roles('Committee')
  async confirm(
    @Param('assessmentId', uuid) assessmentId: string,
    @Body() body: ConfirmAssessmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.confirm(assessmentId, user, body);
  }

  @Post(':assessmentId/override')
  @HttpCode(200)
  @Roles('Committee')
  async override(
    @Param('assessmentId', uuid) assessmentId: string,
    @Body() body: OverrideAssessmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.override(assessmentId, user, body);
  }
}
