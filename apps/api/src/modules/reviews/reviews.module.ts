import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { RubricsController } from './rubrics.controller';
import { RubricsService } from './rubrics.service';

@Module({
  controllers: [ReviewsController, RubricsController],
  providers: [ReviewsService, RubricsService],
  exports: [ReviewsService, RubricsService],
})
export class ReviewsModule {}
