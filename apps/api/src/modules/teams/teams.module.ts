import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamRequestsService } from './team-requests.service';
import { TeamRequestsController } from './team-requests.controller';

@Module({
  controllers: [TeamsController, TeamRequestsController],
  providers: [TeamsService, TeamRequestsService],
})
export class TeamsModule {}
