import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiError } from '@blulens/shared';

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
  401: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
  403: 'คุณไม่มีสิทธิ์ทำรายการนี้',
  404: 'ไม่พบข้อมูลที่ต้องการ',
  409: 'ข้อมูลขัดแย้งกับที่มีอยู่ในระบบ',
  429: 'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
  500: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่หรือติดต่อผู้ดูแล',
};

/** แปลง exception ทุกชนิดเป็น envelope { success: false, error } มาตรฐานเดียว */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = DEFAULT_MESSAGES[500]!;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? 'ERROR';
      message = DEFAULT_MESSAGES[status] ?? message;
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const b = body as { code?: string; message?: string | string[]; details?: unknown };
        // only ApiException carries a code + Thai message; Nest built-ins (e.g. unknown route) keep the Thai default
        if (b.code) {
          code = b.code;
          if (typeof b.message === 'string') message = b.message;
          if (b.details !== undefined) details = b.details;
        }
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const payload: ApiError = { success: false, error: { code, message, details } };
    res.status(status).json(payload);
  }
}
