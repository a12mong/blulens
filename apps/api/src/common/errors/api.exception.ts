import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception มาตรฐานของระบบ — บังคับให้ทุก error มี code โครงสร้าง + ข้อความภาษาไทย
 * exception filter จะแปลงเป็น envelope { success: false, error: { code, message, details } }
 */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static unauthorized(message = 'กรุณาเข้าสู่ระบบก่อนใช้งาน', code = 'AUTH_REQUIRED') {
    return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(message = 'คุณไม่มีสิทธิ์ทำรายการนี้', code = 'FORBIDDEN') {
    return new ApiException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(message = 'ไม่พบข้อมูลที่ต้องการ', code = 'NOT_FOUND') {
    return new ApiException(HttpStatus.NOT_FOUND, code, message);
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message, details);
  }

  static conflict(code: string, message: string) {
    return new ApiException(HttpStatus.CONFLICT, code, message);
  }
}
