import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { type AuthUser, type AuthedRequest } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { TeamMembersService, type TeamMemberResult } from './team-members.service';

const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  validFrom: z.string().date(),
});

export class AddTeamMemberDto extends createZodDto(addTeamMemberSchema) {}

@Controller('teams')
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Roles('Committee', 'Admin')
  @Post(':teamId/members')
  @HttpCode(201)
  async addMember(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() body: AddTeamMemberDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<TeamMemberResult> {
    return this.teamMembersService.addMember(teamId, body, actor, req.ip);
  }
}
