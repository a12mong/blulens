import { Body, Controller, Get, HttpCode, Post, Param } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { CalibrationService } from './calibration.service';
import type { AuthUser } from '../../common/auth/auth.types';

const CreateCalibrationSetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(16).optional(),
});

export class CreateCalibrationSetDto extends createZodDto(CreateCalibrationSetSchema) {}

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
}
