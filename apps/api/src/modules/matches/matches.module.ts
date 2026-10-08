import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { UmpireController } from './umpire.controller';

@Module({
  controllers: [MatchesController, UmpireController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
