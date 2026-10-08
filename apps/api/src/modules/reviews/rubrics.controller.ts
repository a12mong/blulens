import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
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
}
