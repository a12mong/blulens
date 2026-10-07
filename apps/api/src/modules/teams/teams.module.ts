import { Module } from '@nestjs/common';
import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';
import { TeamRequestsController } from './team-requests.controller';
import { TeamRequestsService } from './team-requests.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController, TeamMembersController, TeamRequestsController],
  providers: [TeamsService, TeamMembersService, TeamRequestsService],
  exports: [TeamsService, TeamMembersService, TeamRequestsService],
})
export class TeamsModule {}
