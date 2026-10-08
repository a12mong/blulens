import { Module } from '@nestjs/common';
import { RaterStatsController } from './rater-stats.controller';
import { RaterStatsService } from './rater-stats.service';

@Module({
  controllers: [RaterStatsController],
  providers: [RaterStatsService],
  exports: [RaterStatsService],
})
export class RaterStatsModule {}
