import { ApiRequestError } from './api/client';

const MESSAGES: Record<string, string> = {
  ENTRIES_CLOSED: 'ปิดรับสมัครแล้ว',
  ENTRY_DUPLICATE_PLAYER: 'ผู้เล่นซ้ำในคู่เดียวกัน',
  ENTRY_PLAYER_COUNT: 'จำนวนผู้เล่นไม่ถูกต้อง',
  ENTRY_NOT_DRAFT: 'ผู้สมัครไม่อยู่ในสถานะร่างขอ',
  ENTRY_NOT_EDITABLE: 'ไม่สามารถแก้ไขผู้สมัครนี้ได้',
  ENTRY_NOT_PENDING: 'ผู้สมัครไม่อยู่ในสถานะรอพิจารณา',
  ENTRY_PLAYER_UNGRADED: 'ผู้เล่นยังไม่ได้รับการให้เกรด',
  ENTRY_FRESH_ASSESSMENT_MISSING: 'ไม่พบการประเมินใหม่ที่จำเป็น',
  ENTRY_OUT_OF_BAND_REASON_REQUIRED: 'ต้องระบุเหตุผลสำหรับเกรดนอกช่วง',
  TEAM_EXISTS: 'ทีมนี้มีอยู่แล้ว',
  TEAM_NOT_FOUND: 'ไม่พบทีม',
  USER_NOT_FOUND: 'ไม่พบผู้ใช้',
  EVENT_NOT_FOUND: 'ไม่พบงาน',
  TOURNAMENT_INVALID_TRANSITION: 'สถานะการแข่งขันไม่ถูกต้อง',
  VALIDATION_FAILED: 'ข้อมูลไม่ถูกต้อง',
  FORBIDDEN: 'คุณไม่มีสิทธิ์ทำรายการนี้',
  NOT_FOUND: 'ไม่พบรายการที่ขอ',
  REVIEW_ALREADY_SUBMITTED: 'ส่งผลประเมินไปแล้ว แก้ไขไม่ได้',
  ASSIGNMENT_EXPIRED: 'งานนี้หมดเวลาแล้ว',
  MATCH_SCORE_INVALID: 'คะแนนไม่ถูกต้องตามกติกา',
  STAGE_CONFIRMED: 'รอบนี้ยืนยันแล้ว แก้ไขไม่ได้',
  MATCH_ALREADY_CONFIRMED: 'แมตช์นี้ถูกยืนยันแล้ว',
  UMPIRE_NOT_ASSIGNED: 'คุณไม่ได้รับมอบหมายแมตช์นี้',
  UMPIRE_OWN_MATCH: 'ห้ามกรอกผลแมตช์ที่ตนเองเป็นผู้เล่น',
};

function hasThai(text: string): boolean {
  return /[฀-๿]/.test(text);
}

export function thaiError(e: unknown, fallback?: string): string {
  if (e instanceof ApiRequestError) {
    const thai = MESSAGES[e.code];
    if (thai) return thai;
  }

  if (e instanceof TypeError) {
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
  }

  if (e instanceof Error) {
    if (hasThai(e.message)) {
      return e.message;
    }
  }

  return fallback || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}
