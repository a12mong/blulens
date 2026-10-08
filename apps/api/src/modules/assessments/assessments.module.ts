import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { ClipsController } from './clips.controller';

@Module({
  controllers: [AssessmentsController, ClipsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
