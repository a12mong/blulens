/** Response envelope มาตรฐานของ API ทุก endpoint (master spec ข้อ 8.4) */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  /** โค้ดโครงสร้าง เช่น AUTH_INVALID_CREDENTIALS, FORBIDDEN, VALIDATION_ERROR */
  code: string;
  /** ข้อความภาษาไทยพร้อมแสดงต่อผู้ใช้ */
  message: string;
  /** รายละเอียดเพิ่มเติม เช่น field validation errors */
  details?: unknown;
}

export interface ApiError {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
