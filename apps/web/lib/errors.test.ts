import { describe, it, expect } from 'vitest';
import { thaiError } from './errors';
import { ApiRequestError } from './api/client';

describe('thaiError', () => {
  it('maps known codes to Thai, passes through Thai server messages, hides English ones', () => {
    // Known code -> Thai
    const entriesClosed = new ApiRequestError(400, 'ENTRIES_CLOSED', 'Entries are closed');
    expect(thaiError(entriesClosed)).toBe('ปิดรับสมัครแล้ว');

    // Unknown code with Thai message -> passes through
    const unknownWithThai = new ApiRequestError(400, 'UNKNOWN_CODE', 'ผู้เล่นไม่พบ');
    expect(thaiError(unknownWithThai)).toBe('ผู้เล่นไม่พบ');

    // Unknown code with English message -> fallback
    const unknownWithEnglish = new ApiRequestError(400, 'UNKNOWN_CODE', 'Internal error');
    expect(thaiError(unknownWithEnglish, 'Custom fallback')).toBe('Custom fallback');

    // Unknown code with English, no fallback -> generic Thai fallback
    expect(thaiError(unknownWithEnglish)).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');

    // TypeError -> network message
    const netError = new TypeError('fetch failed');
    expect(thaiError(netError)).toBe('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  });

  it('every listed code has a non-empty Thai text', () => {
    const codes = [
      'ENTRIES_CLOSED',
      'ENTRY_DUPLICATE_PLAYER',
      'ENTRY_PLAYER_COUNT',
      'ENTRY_NOT_DRAFT',
      'ENTRY_NOT_EDITABLE',
      'ENTRY_NOT_PENDING',
      'ENTRY_PLAYER_UNGRADED',
      'ENTRY_FRESH_ASSESSMENT_MISSING',
      'ENTRY_OUT_OF_BAND_REASON_REQUIRED',
      'TEAM_EXISTS',
      'TEAM_NOT_FOUND',
      'USER_NOT_FOUND',
      'EVENT_NOT_FOUND',
      'TOURNAMENT_INVALID_TRANSITION',
      'VALIDATION_FAILED',
      'FORBIDDEN',
      'NOT_FOUND',
      'REVIEW_ALREADY_SUBMITTED',
      'ASSIGNMENT_EXPIRED',
      'MATCH_SCORE_INVALID',
      'STAGE_CONFIRMED',
      'MATCH_ALREADY_CONFIRMED',
      'UMPIRE_NOT_ASSIGNED',
      'UMPIRE_OWN_MATCH',
      'REVIEWER_CONFLICT_OF_INTEREST',
      'REVIEWER_NOT_ELIGIBLE',
      'ASSESSMENT_NOT_ASSIGNABLE',
      'MATCH_NOT_REPORTED',
      'EVENT_NOT_GROUP_FORMAT',
      'DRAW_ALREADY_LOCKED',
      'NOT_ENOUGH_ENTRIES',
      'DRAW_VERSION_CONFLICT',
      'GROUP_SIZES_IMPOSSIBLE',
      'DRAW_NOT_FOUND',
      'DRAW_INPUT_CHANGED',
      'DRAW_CONFLICTS_NOT_ACKNOWLEDGED',
      'DRAW_KIND_NOT_SUPPORTED',
    ];

    codes.forEach((code) => {
      const err = new ApiRequestError(400, code, 'test message');
      const result = thaiError(err);
      expect(result).not.toEqual('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
