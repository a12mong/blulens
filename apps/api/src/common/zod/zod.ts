import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { z, ZodSchema } from 'zod';
import { ApiException } from '../errors/api.exception';

/**
 * Validation ด้วย zod schema จาก packages/shared — source of truth เดียว
 * ของ type ทั้ง frontend/backend (master spec ข้อ 11 "Types แหล่งเดียว")
 *
 * วิธีใช้: `class LoginDto extends createZodDto(loginSchema) {}` แล้วใช้เป็น type
 * ของ @Body() — ZodValidationPipe (global) จะ validate ให้อัตโนมัติ
 */

export interface ZodDtoClass<T> {
  new (): T;
  schema: ZodSchema;
}

/** type ของ DTO = z.output ของ schema (หลัง default/transform ทำงานแล้ว) */
export function createZodDto<S extends z.ZodTypeAny>(schema: S): ZodDtoClass<z.output<S>> {
  class ZodDto {
    static readonly schema = schema;
  }
  return ZodDto as unknown as ZodDtoClass<z.output<S>>;
}

function isZodDto(metatype: unknown): metatype is ZodDtoClass<unknown> {
  return (
    typeof metatype === 'function' &&
    'schema' in metatype &&
    typeof (metatype as { schema?: { safeParse?: unknown } }).schema?.safeParse === 'function'
  );
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { metatype } = metadata;
    if (!isZodDto(metatype)) return value;

    const result = metatype.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_';
        (fieldErrors[path] ??= []).push(issue.message);
      }
      const firstMessage = result.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';
      throw ApiException.badRequest('VALIDATION_ERROR', firstMessage, { fieldErrors });
    }
    return result.data;
  }
}
