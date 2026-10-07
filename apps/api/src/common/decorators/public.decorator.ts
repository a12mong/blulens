import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** endpoint ที่ไม่ต้อง login (login, register, refresh, forgot password) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
