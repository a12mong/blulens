import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { gradeKeySchema } from '@blulens/shared';
import { CLIP_CONTENT_TYPES, CLIP_MAX_BYTES } from '../../common/storage/storage.service';
import { CalibrationService } from './calibration.service';
import type { AuthUser } from '../../common/auth/auth.types';

const CreateCalibrationSetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(16).optional(),
});

export class CreateCalibrationSetDto extends createZodDto(CreateCalibrationSetSchema) {}

class PatchClipDto extends createZodDto(z.object({ referenceKey: gradeKeySchema })) {}

class ClipUploadUrlDto extends createZodDto(
  z.object({
    fileName: z.string().min(1).max(255),
    contentType: z.enum(CLIP_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(CLIP_MAX_BYTES),
    referenceKey: gradeKeySchema,
  }),
) {}

class CompleteClipDto extends createZodDto(z.object({ durationSec: z.number().int().min(1) })) {}

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('calibration-sets')
export class CalibrationController {
  constructor(private readonly service: CalibrationService) {}

  @Get()
  @Roles('Committee', 'Admin')
  listCalibrationSets() {
    return this.service.listCalibrationSets();
  }

  @Post()
  @HttpCode(201)
  @Roles('Committee', 'Admin')
  createCalibrationSet(@Body() body: CreateCalibrationSetDto, @CurrentUser() user: AuthUser) {
    return this.service.createCalibrationSet(body.name, body.period, user);
  }

  @Get(':setId/results')
  @Roles('Committee', 'Admin')
  results(@Param('setId', uuid) setId: string) {
    return this.service.getResults(setId);
  }

  @Get(':setId')
  @Roles('Committee', 'Admin')
  getSetDetail(@Param('setId', new ParseUUIDPipe()) setId: string) {
    return this.service.getSetDetail(setId);
  }

  @Post(':setId/assign')
  @HttpCode(204)
  @Roles('Committee', 'Admin')
  assignCalibrationSet(
    @Param('setId', new ParseUUIDPipe()) setId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assignCalibrationSet(setId, body, user);
  }

  @Post(':setId/clips/upload-url')
  @HttpCode(200)
  @Roles('Committee', 'Admin')
  clipUploadUrl(
    @Param('setId', uuid) setId: string,
    @Body() body: ClipUploadUrlDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createClipUpload(setId, body, user);
  }

  @Post(':setId/clips/:clipId/complete')
  @HttpCode(200)
  @Roles('Committee', 'Admin')
  completeClip(
    @Param('setId', uuid) setId: string,
    @Param('clipId', uuid) clipId: string,
    @Body() body: CompleteClipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.completeClip(setId, clipId, body.durationSec, user);
  }

  @Patch(':setId/clips/:clipId')
  @Roles('Committee', 'Admin')
  patchClip(
    @Param('setId', uuid) setId: string,
    @Param('clipId', uuid) clipId: string,
    @Body() body: PatchClipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateClipReference(setId, clipId, body.referenceKey, user);
  }

  @Delete(':setId/clips/:clipId')
  @HttpCode(204)
  @Roles('Committee', 'Admin')
  async deleteClip(
    @Param('setId', uuid) setId: string,
    @Param('clipId', uuid) clipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.deleteClip(setId, clipId, user);
  }
}
