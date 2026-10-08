import { ApiRequestError } from './api/client';

const MESSAGES: Record<string, string> = {
  ENTRIES_CLOSED: 'ปิดรับสมัครแล้ว',
  ENTRY_DUPLICATE_PLAYER: 'ผู้เล่นซ้ำในคู่เดียวกัน',
  ENTRY_PLAYER_COUNT: 'จำนวนผู้เล่นไม่ถูกต้อง',
  ENTRY_NOT_DRAFT: 'ผู้สมัครไม่อยู่ในสถานะร่างขอ',
  ENTRY_NOT_EDITABLE: 'ไม่สามารถแก้ไขผู้สมัครนี้ได้',
  ENTRY_NOT_PENDING: 'ผู้สมัครไม่อยู่ในสถานะรอพิจารณา',
  ENTRY_PLAYER_UNGRADED: 'ผู้เล่นยังไม่ได้รับการให้เกรด',
  ASSESSMENT_INVALID_TRANSITION: 'สถานะปัจจุบันไม่รองรับการดำเนินการนี้',
  ASSESSMENT_NOT_PROVISIONAL: 'ผลนี้ไม่ใช่ผลชั่วคราว ยืนยันไม่ได้',
  ASSESSMENT_APPROVE_NOTE_REQUIRED: 'ต้องระบุหมายเหตุอย่างน้อย 5 ตัวอักษรเมื่ออนุมัติผลที่เห็นต่างกัน',
  OVERRIDE_CONFLICT_OF_INTEREST: 'คุณสังกัดทีมเดียวกับผู้ถูกประเมิน จึงแก้ผลไม่ได้',
  RESULT_VERSION_STALE: 'ผลมีการเปลี่ยนแปลงแล้ว กรุณาโหลดหน้าใหม่',
  ASSESSMENT_STATE_CHANGED: 'มีผู้ตัดสินใจไปก่อนแล้ว กรุณาโหลดหน้าใหม่',
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
  NEXT_MATCH_ALREADY_PLAYED: 'แมตช์รอบถัดไปแข่งไปแล้ว แก้ผลนี้ไม่ได้ (ไม่มีอะไรถูกเปลี่ยน)',
  MATCH_ALREADY_CONFIRMED: 'แมตช์นี้ถูกยืนยันแล้ว',
  UMPIRE_NOT_ASSIGNED: 'คุณไม่ได้รับมอบหมายแมตช์นี้',
  UMPIRE_OWN_MATCH: 'ห้ามกรอกผลแมตช์ที่ตนเองเป็นผู้เล่น',
  REVIEWER_CONFLICT_OF_INTEREST: 'ผู้ประเมินสังกัดทีมเดียวกับผู้ถูกประเมิน',
  REVIEWER_NOT_ELIGIBLE: 'ผู้ใช้นี้ไม่มีสิทธิ์เป็นผู้ประเมิน',
  ASSESSMENT_NOT_ASSIGNABLE: 'สถานะนี้มอบหมายผู้ประเมินเพิ่มไม่ได้',
  MATCH_NOT_REPORTED: 'แมตช์นี้ไม่ได้อยู่ในสถานะรอยืนยัน',
  EVENT_NOT_GROUP_FORMAT: 'รายการนี้ไม่ใช่รูปแบบแบ่งกลุ่ม',
  DRAW_ALREADY_LOCKED: 'จับกลุ่มล็อกแล้ว',
  NOT_ENOUGH_ENTRIES: 'จำนวนผู้สมัครไม่พอจับกลุ่ม',
  DRAW_VERSION_CONFLICT: 'มีการจับกลุ่มใหม่แล้ว โปรดโหลดซ้ำ',
  GROUP_SIZES_IMPOSSIBLE: 'แบ่งกลุ่มตามจำนวนนี้ไม่ได้',
  DRAW_NOT_FOUND: 'ไม่พบการจับกลุ่ม',
  DRAW_INPUT_CHANGED: 'รายชื่อผู้สมัครเปลี่ยนแล้ว โปรดจับกลุ่มใหม่',
  DRAW_CONFLICTS_NOT_ACKNOWLEDGED: 'ต้องรับทราบทีมที่ชนกันก่อนเผยแพร่',
  DRAW_KIND_NOT_SUPPORTED: 'ยังไม่รองรับรูปแบบนี้',
  GROUP_MATCHES_INCOMPLETE: 'ยังมีแมตช์รอบกลุ่มที่ยังไม่ยืนยัน',
  NO_PUBLISHED_GROUP_DRAW: 'ยังไม่ได้เผยแพร่การจับกลุ่ม',
  GROUP_STAGE_NOT_CONFIRMED: 'ต้องยืนยันผลรอบกลุ่มก่อนจัดสายน็อกเอาต์',
  UMPIRE_NOT_ELIGIBLE: 'กรรมการนี้ไม่มีสิทธิ์ในรายการนี้',
  UMPIRE_IS_PLAYER: 'กรรมการเป็นผู้เล่นในแมตช์นี้',
  MATCH_LOCKED: 'แมตช์นี้ล็อกแล้ว',
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
