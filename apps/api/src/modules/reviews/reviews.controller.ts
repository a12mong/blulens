import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { gradeKeySchema } from '@blulens/shared';
import type { AuthedRequest, AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { ReviewsService } from './reviews.service';

const MyAssignmentsQuerySchema = z.object({
  state: z.enum(['open', 'submitted', 'expired']).optional(),
});

class MyAssignmentsQueryDto extends createZodDto(MyAssignmentsQuerySchema) {}

const ReviewInputSchema = z.object({
  scores: z
    .array(
      z.object({
        criterion: z.string().min(1).max(40),
        gradeKey: gradeKeySchema.nullable(),
      }),
    )
    .min(1),
  comment: z.string().trim().max(2000).optional(),
});

export class ReviewInputDto extends createZodDto(ReviewInputSchema) {}

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('rubric')
  getRubric() {
    return this.reviewsService.getActiveRubric();
  }

  @Roles('Reviewer')
  @Get('reviews/assignments/me')
  myAssignments(@Query() query: MyAssignmentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.reviewsService.getMyAssignments(user.id, query.state);
  }

  @Roles('Reviewer')
  @Put('reviews/assignments/:assignmentId')
  submit(
    @Param('assignmentId', uuid) assignmentId: string,
    @Body() body: ReviewInputDto,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ) {
    return this.reviewsService.submit(assignmentId, body, user, req.ip);
  }
}
