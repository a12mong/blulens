import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Body,
} from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RubricsService } from './rubrics.service';

@Controller('rubrics')
export class RubricsController {
  constructor(private readonly rubricsService: RubricsService) {}

  @Roles('Committee', 'Admin')
  @Get()
  getRubrics(@CurrentUser() user: AuthUser) {
    return this.rubricsService.getRubrics(user);
  }

  @Roles('Committee', 'Admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createDraft(@CurrentUser() user: AuthUser) {
    return this.rubricsService.createDraft(user);
  }

  @Roles('Committee', 'Admin')
  @Put(':rubricId')
  updateDraft(
    @Param('rubricId', new ParseUUIDPipe()) rubricId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rubricsService.updateDraft(rubricId, body, user);
  }

  @Roles('Committee', 'Admin')
  @Delete(':rubricId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDraft(
    @Param('rubricId', new ParseUUIDPipe()) rubricId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rubricsService.deleteDraft(rubricId, user);
  }

  @Roles('Committee', 'Admin')
  @Post(':rubricId/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('rubricId', new ParseUUIDPipe()) rubricId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rubricsService.activate(rubricId, body, user);
  }
}
