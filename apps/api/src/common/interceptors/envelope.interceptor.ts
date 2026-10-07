import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccess } from '@blulens/shared';

/** ห่อ response ทุก endpoint เป็น { success: true, data } (master spec ข้อ 8.4) */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiSuccess<unknown>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data: data ?? null })));
  }
}
