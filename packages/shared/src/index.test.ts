import { describe, expect, it } from 'vitest';
import type { ApiSuccess } from './index';

describe('@blulens/shared', () => {
  it('exposes the API envelope type', () => {
    const ok: ApiSuccess<{ status: string }> = { success: true, data: { status: 'ok' } };
    expect(ok.success).toBe(true);
  });
});
