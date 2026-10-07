import type { MatchFormat } from '../schemas/format';
import { validateMatchScore } from './match-score';

export type MatchFlag = 'UMPIRE_TEAM_CONFLICT' | 'COMMITTEE_DIRECT_ENTRY' | 'CORRECTED';

export interface ResultMatch {
  status: 'scheduled' | 'reported' | 'confirmed';
  games: [number, number][] | null;
  playerIds: string[];
  playerTeamIds: string[];
  umpireId: string | null;
  court: string | null;
  reportedBy: string | null;
  version: number;
  flags: MatchFlag[];
  locked: boolean;
}

export type ResultActor =
  | { kind: 'umpire'; userId: string; teamIds: string[]; courts: string[] }
  | { kind: 'committee'; userId: string };

export type ResultAction =
  | { type: 'report'; games: [number, number][] } // umpire
  | { type: 'confirm' } // committee
  | { type: 'reject'; reason: string } // committee
  | { type: 'enter'; games: [number, number][] } // committee direct entry
  | { type: 'correct'; games: [number, number][]; reason: string }; // committee

export type TransitionResult =
  { ok: true; match: ResultMatch } | { ok: false; code: string; message: string };

/**
 * Pure state machine for match result transitions (tournament-format.md §5.1, packet bl-20-6).
 * Never mutates the input object.
 */
export function matchResultTransition(
  m: ResultMatch,
  actor: ResultActor,
  action: ResultAction,
  format: MatchFormat,
): TransitionResult {
  switch (action.type) {
    case 'report': {
      if (actor.kind !== 'umpire') {
        return { ok: false, code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ทำรายการนี้' };
      }

      if (!(
        m.status === 'scheduled' ||
        (m.status === 'reported' && m.reportedBy === actor.userId)
      )) {
        return { ok: false, code: 'MATCH_NOT_REPORTABLE', message: 'ไม่สามารถรายงานผลแมตช์นี้ได้' };
      }

      if (m.playerIds.includes(actor.userId)) {
        return {
          ok: false,
          code: 'UMPIRE_IS_PLAYER',
          message: 'ห้ามกรรมการรายงานผลแมตช์ที่ตนเองเป็นผู้เล่น',
        };
      }

      const isAssigned =
        m.umpireId === actor.userId || (m.court != null && actor.courts.includes(m.court));
      if (!isAssigned) {
        return {
          ok: false,
          code: 'UMPIRE_NOT_ASSIGNED',
          message: 'กรรมการไม่ได้รับมอบหมายให้ทำหน้าที่ในแมตช์หรือสนามนี้',
        };
      }

      const scoreResult = validateMatchScore(action.games, format);
      if (!scoreResult.ok) {
        return { ok: false, code: scoreResult.code, message: scoreResult.message };
      }

      const hasTeamConflict = actor.teamIds.some((t) => m.playerTeamIds.includes(t));
      const flags = [...m.flags];
      if (hasTeamConflict && !flags.includes('UMPIRE_TEAM_CONFLICT')) {
        flags.push('UMPIRE_TEAM_CONFLICT');
      }

      return {
        ok: true,
        match: {
          status: 'reported',
          games: action.games.map(([a, b]) => [a, b]),
          playerIds: [...m.playerIds],
          playerTeamIds: [...m.playerTeamIds],
          umpireId: m.umpireId,
          court: m.court,
          reportedBy: actor.userId,
          version: m.version,
          flags,
          locked: m.locked,
        },
      };
    }

    case 'confirm': {
      if (actor.kind !== 'committee') {
        return { ok: false, code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ทำรายการนี้' };
      }

      if (m.status !== 'reported') {
        return { ok: false, code: 'MATCH_NOT_REPORTED', message: 'แมตช์ยังไม่ได้รายงานผล' };
      }

      return {
        ok: true,
        match: {
          status: 'confirmed',
          games: m.games ? m.games.map(([a, b]) => [a, b]) : null,
          playerIds: [...m.playerIds],
          playerTeamIds: [...m.playerTeamIds],
          umpireId: m.umpireId,
          court: m.court,
          reportedBy: m.reportedBy,
          version: m.version,
          flags: [...m.flags],
          locked: m.locked,
        },
      };
    }

    case 'reject': {
      if (actor.kind !== 'committee') {
        return { ok: false, code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ทำรายการนี้' };
      }

      if (m.status !== 'reported') {
        return { ok: false, code: 'MATCH_NOT_REPORTED', message: 'แมตช์ยังไม่ได้รายงานผล' };
      }

      if (action.reason.trim().length < 5) {
        return {
          ok: false,
          code: 'REASON_REQUIRED',
          message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
        };
      }

      return {
        ok: true,
        match: {
          status: 'scheduled',
          games: null,
          playerIds: [...m.playerIds],
          playerTeamIds: [...m.playerTeamIds],
          umpireId: m.umpireId,
          court: m.court,
          reportedBy: null,
          version: m.version,
          flags: m.flags.filter((f) => f !== 'UMPIRE_TEAM_CONFLICT'),
          locked: m.locked,
        },
      };
    }

    case 'enter': {
      if (actor.kind !== 'committee') {
        return { ok: false, code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ทำรายการนี้' };
      }

      if (m.status !== 'scheduled') {
        return {
          ok: false,
          code: 'MATCH_NOT_SCHEDULED',
          message: 'แมตช์ไม่ได้อยู่ในสถานะกำหนดการ',
        };
      }

      const scoreResult = validateMatchScore(action.games, format);
      if (!scoreResult.ok) {
        return { ok: false, code: scoreResult.code, message: scoreResult.message };
      }

      const flags = [...m.flags];
      if (!flags.includes('COMMITTEE_DIRECT_ENTRY')) {
        flags.push('COMMITTEE_DIRECT_ENTRY');
      }

      return {
        ok: true,
        match: {
          status: 'confirmed',
          games: action.games.map(([a, b]) => [a, b]),
          playerIds: [...m.playerIds],
          playerTeamIds: [...m.playerTeamIds],
          umpireId: m.umpireId,
          court: m.court,
          reportedBy: m.reportedBy,
          version: m.version,
          flags,
          locked: m.locked,
        },
      };
    }

    case 'correct': {
      if (actor.kind !== 'committee') {
        return { ok: false, code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ทำรายการนี้' };
      }

      if (m.status !== 'confirmed') {
        return { ok: false, code: 'MATCH_NOT_CONFIRMED', message: 'แมตช์ยังไม่ได้รับการยืนยันผล' };
      }

      if (m.locked) {
        return { ok: false, code: 'MATCH_LOCKED', message: 'แมตช์ถูกล็อกแล้ว ไม่สามารถแก้ไขผลได้' };
      }

      if (action.reason.trim().length < 5) {
        return {
          ok: false,
          code: 'REASON_REQUIRED',
          message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
        };
      }

      const scoreResult = validateMatchScore(action.games, format);
      if (!scoreResult.ok) {
        return { ok: false, code: scoreResult.code, message: scoreResult.message };
      }

      const flags = [...m.flags];
      if (!flags.includes('CORRECTED')) {
        flags.push('CORRECTED');
      }

      return {
        ok: true,
        match: {
          status: 'confirmed',
          games: action.games.map(([a, b]) => [a, b]),
          playerIds: [...m.playerIds],
          playerTeamIds: [...m.playerTeamIds],
          umpireId: m.umpireId,
          court: m.court,
          reportedBy: m.reportedBy,
          version: m.version + 1,
          flags,
          locked: m.locked,
        },
      };
    }
  }
}
