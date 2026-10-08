import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';

@Module({
  imports: [MatchesModule],
  controllers: [DrawsController],
  providers: [DrawsService],
  exports: [DrawsService],
})
export class DrawsModule {}
