import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { ReviewsService } from './reviews.service';

const MyAssignmentsQuerySchema = z.object({
  state: z.enum(['open', 'submitted', 'expired']).optional(),
});

class MyAssignmentsQueryDto extends createZodDto(MyAssignmentsQuerySchema) {}

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
}
