import { describe, expect, it } from 'vitest';
import type { MatchFormat } from '../schemas/format';
import type { ResultActor, ResultMatch } from './match-result';
import { matchResultTransition } from './match-result';

describe('matchResultTransition (bl-20-6)', () => {
  const bo3_21: MatchFormat = {
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
    drawAllowed: false,
  };

  const group_2x15: MatchFormat = {
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    drawAllowed: true,
  };

  function createBaseMatch(overrides?: Partial<ResultMatch>): ResultMatch {
    return {
      status: 'scheduled',
      games: null,
      playerIds: ['p1', 'p2'],
      playerTeamIds: ['team-a', 'team-b'],
      umpireId: 'umpire-1',
      court: 'court-1',
      reportedBy: null,
      version: 1,
      flags: [],
      locked: false,
      ...overrides,
    };
  }

  const umpireActor: ResultActor = {
    kind: 'umpire',
    userId: 'umpire-1',
    teamIds: ['team-neutral'],
    courts: ['court-1'],
  };

  const committeeActor: ResultActor = {
    kind: 'committee',
    userId: 'comm-1',
  };

  describe('Happy path transitions', () => {
    it('scheduled --umpire report--> reported (happy path row 1)', () => {
      const match = createBaseMatch();
      const before = structuredClone(match);

      const res = matchResultTransition(
        match,
        umpireActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('reported');
        expect(res.match.games).toEqual([
          [21, 15],
          [21, 18],
        ]);
        expect(res.match.reportedBy).toBe('umpire-1');
        expect(res.match.flags).toEqual([]);
        expect(res.match.version).toBe(1);
        expect(res.match.locked).toBe(false);
      }
      expect(match).toEqual(before);
    });

    it('umpire assigned by court alone can report', () => {
      const match = createBaseMatch({ umpireId: null, court: 'court-2' });
      const actor: ResultActor = {
        kind: 'umpire',
        userId: 'umpire-2',
        teamIds: [],
        courts: ['court-1', 'court-2'],
      };

      const res = matchResultTransition(
        match,
        actor,
        {
          type: 'report',
          games: [
            [21, 19],
            [21, 19],
          ],
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('reported');
        expect(res.match.reportedBy).toBe('umpire-2');
      }
    });

    it('adds UMPIRE_TEAM_CONFLICT flag when umpire shares a team with a player', () => {
      const match = createBaseMatch();
      const conflictActor: ResultActor = {
        kind: 'umpire',
        userId: 'umpire-1',
        teamIds: ['team-a'], // shares team-a with p1
        courts: ['court-1'],
      };

      const res = matchResultTransition(
        match,
        conflictActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.flags).toEqual(['UMPIRE_TEAM_CONFLICT']);
      }
    });

    it('reported --same umpire edits--> reported (happy path row 2)', () => {
      const match = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
        reportedBy: 'umpire-1',
      });
      const before = structuredClone(match);

      const res = matchResultTransition(
        match,
        umpireActor,
        {
          type: 'report',
          games: [
            [21, 10],
            [21, 12],
          ],
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('reported');
        expect(res.match.games).toEqual([
          [21, 10],
          [21, 12],
        ]);
        expect(res.match.reportedBy).toBe('umpire-1');
      }
      expect(match).toEqual(before);
    });

    it('team-conflict flag is added once even on re-report', () => {
      const match = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
        reportedBy: 'umpire-1',
        flags: ['UMPIRE_TEAM_CONFLICT'],
      });

      const conflictActor: ResultActor = {
        kind: 'umpire',
        userId: 'umpire-1',
        teamIds: ['team-a'],
        courts: ['court-1'],
      };

      const res = matchResultTransition(
        match,
        conflictActor,
        {
          type: 'report',
          games: [
            [21, 10],
            [21, 12],
          ],
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.flags).toEqual(['UMPIRE_TEAM_CONFLICT']);
      }
    });

    it('reported --Committee confirm--> confirmed (happy path row 3)', () => {
      const match = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
        reportedBy: 'umpire-1',
        flags: ['UMPIRE_TEAM_CONFLICT'],
      });
      const before = structuredClone(match);

      const res = matchResultTransition(match, committeeActor, { type: 'confirm' }, bo3_21);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('confirmed');
        expect(res.match.games).toEqual([
          [21, 15],
          [21, 18],
        ]);
        expect(res.match.reportedBy).toBe('umpire-1');
        expect(res.match.flags).toEqual(['UMPIRE_TEAM_CONFLICT']);
        expect(res.match.version).toBe(1);
      }
      expect(match).toEqual(before);
    });

    it('reported --Committee reject with reason--> scheduled (happy path row 4)', () => {
      const match = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
        reportedBy: 'umpire-1',
        flags: ['UMPIRE_TEAM_CONFLICT'],
      });
      const before = structuredClone(match);

      const res = matchResultTransition(
        match,
        committeeActor,
        { type: 'reject', reason: 'คะแนนเกมที่สองไม่ตรงกับใบบันทึก' },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('scheduled');
        expect(res.match.games).toBeNull();
        expect(res.match.reportedBy).toBeNull();
        expect(res.match.flags).toEqual([]); // UMPIRE_TEAM_CONFLICT stripped
      }
      expect(match).toEqual(before);
    });

    it('scheduled --Committee enters directly--> confirmed + COMMITTEE_DIRECT_ENTRY (happy path row 5)', () => {
      const match = createBaseMatch();
      const before = structuredClone(match);

      const res = matchResultTransition(
        match,
        committeeActor,
        {
          type: 'enter',
          games: [
            [21, 12],
            [21, 14],
          ],
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('confirmed');
        expect(res.match.games).toEqual([
          [21, 12],
          [21, 14],
        ]);
        expect(res.match.flags).toContain('COMMITTEE_DIRECT_ENTRY');
        expect(res.match.version).toBe(1);
      }
      expect(match).toEqual(before);
    });

    it('confirmed --Committee correct with reason--> confirmed version+1 + CORRECTED (happy path row 6)', () => {
      const match = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 12],
          [21, 14],
        ],
        version: 1,
        locked: false,
      });
      const before = structuredClone(match);

      const res = matchResultTransition(
        match,
        committeeActor,
        {
          type: 'correct',
          games: [
            [21, 19],
            [18, 21],
            [21, 15],
          ],
          reason: 'แก้ไขตามหลักฐานวิดีโอ',
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.status).toBe('confirmed');
        expect(res.match.games).toEqual([
          [21, 19],
          [18, 21],
          [21, 15],
        ]);
        expect(res.match.version).toBe(2);
        expect(res.match.flags).toContain('CORRECTED');
      }
      expect(match).toEqual(before);
    });

    it('multiple corrections increment version without duplicate CORRECTED flag', () => {
      const match = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 19],
          [18, 21],
          [21, 15],
        ],
        version: 2,
        flags: ['CORRECTED'],
        locked: false,
      });

      const res = matchResultTransition(
        match,
        committeeActor,
        {
          type: 'correct',
          games: [
            [21, 12],
            [21, 14],
          ],
          reason: 'แก้ไขคะแนนรอบที่สอง',
        },
        bo3_21,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.match.version).toBe(3);
        expect(res.match.flags).toEqual(['CORRECTED']);
      }
    });
  });

  describe('Error handling & role permissions', () => {
    it('returns FORBIDDEN when committee tries to report', () => {
      const match = createBaseMatch();
      const res = matchResultTransition(
        match,
        committeeActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );
      expect(res).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์ทำรายการนี้',
      });
    });

    it('returns FORBIDDEN when umpire tries committee actions', () => {
      const reportedMatch = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
      });
      const scheduledMatch = createBaseMatch();
      const confirmedMatch = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 15],
          [21, 18],
        ],
      });

      expect(
        matchResultTransition(reportedMatch, umpireActor, { type: 'confirm' }, bo3_21),
      ).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์ทำรายการนี้',
      });

      expect(
        matchResultTransition(
          reportedMatch,
          umpireActor,
          { type: 'reject', reason: 'valid reason' },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์ทำรายการนี้',
      });

      expect(
        matchResultTransition(
          scheduledMatch,
          umpireActor,
          {
            type: 'enter',
            games: [
              [21, 15],
              [21, 18],
            ],
          },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์ทำรายการนี้',
      });

      expect(
        matchResultTransition(
          confirmedMatch,
          umpireActor,
          {
            type: 'correct',
            games: [
              [21, 15],
              [21, 18],
            ],
            reason: 'valid reason',
          },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์ทำรายการนี้',
      });
    });

    it('returns MATCH_NOT_REPORTABLE when reporting a confirmed match', () => {
      const match = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 15],
          [21, 18],
        ],
      });
      const res = matchResultTransition(
        match,
        umpireActor,
        {
          type: 'report',
          games: [
            [21, 10],
            [21, 12],
          ],
        },
        bo3_21,
      );
      expect(res).toEqual({
        ok: false,
        code: 'MATCH_NOT_REPORTABLE',
        message: 'ไม่สามารถรายงานผลแมตช์นี้ได้',
      });
    });

    it('returns MATCH_NOT_REPORTABLE when another umpire tries editing a reported match', () => {
      const match = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
        reportedBy: 'umpire-1',
      });
      const otherUmpire: ResultActor = {
        kind: 'umpire',
        userId: 'umpire-2',
        teamIds: [],
        courts: ['court-1'],
      };

      const res = matchResultTransition(
        match,
        otherUmpire,
        {
          type: 'report',
          games: [
            [21, 10],
            [21, 12],
          ],
        },
        bo3_21,
      );
      expect(res).toEqual({
        ok: false,
        code: 'MATCH_NOT_REPORTABLE',
        message: 'ไม่สามารถรายงานผลแมตช์นี้ได้',
      });
    });

    it('returns UMPIRE_IS_PLAYER when umpire is in playerIds', () => {
      const match = createBaseMatch({
        playerIds: ['umpire-1', 'p2'],
      });
      const res = matchResultTransition(
        match,
        umpireActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );
      expect(res).toEqual({
        ok: false,
        code: 'UMPIRE_IS_PLAYER',
        message: 'ห้ามกรรมการรายงานผลแมตช์ที่ตนเองเป็นผู้เล่น',
      });
    });

    it('returns UMPIRE_NOT_ASSIGNED when umpire is not assigned to match or court', () => {
      const match = createBaseMatch({
        umpireId: 'other-umpire',
        court: 'court-99',
      });
      const unassignedActor: ResultActor = {
        kind: 'umpire',
        userId: 'umpire-1',
        teamIds: [],
        courts: ['court-1'],
      };
      const res = matchResultTransition(
        match,
        unassignedActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );
      expect(res).toEqual({
        ok: false,
        code: 'UMPIRE_NOT_ASSIGNED',
        message: 'กรรมการไม่ได้รับมอบหมายให้ทำหน้าที่ในแมตช์หรือสนามนี้',
      });
    });

    it('returns score validation errors during report', () => {
      const match = createBaseMatch();

      // GAME_SCORE_INVALID
      const invalidRes = matchResultTransition(
        match,
        umpireActor,
        { type: 'report', games: [[25, 10]] },
        bo3_21,
      );
      expect(invalidRes.ok).toBe(false);
      if (!invalidRes.ok) {
        expect(invalidRes.code).toBe('GAME_SCORE_INVALID');
      }

      // GAMES_INCOMPLETE
      const incompleteRes = matchResultTransition(
        match,
        umpireActor,
        { type: 'report', games: [[21, 15]] },
        bo3_21,
      );
      expect(incompleteRes.ok).toBe(false);
      if (!incompleteRes.ok) {
        expect(incompleteRes.code).toBe('GAMES_INCOMPLETE');
      }

      // GAMES_EXTRA
      const extraRes = matchResultTransition(
        match,
        umpireActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
            [21, 10],
          ],
        },
        bo3_21,
      );
      expect(extraRes.ok).toBe(false);
      if (!extraRes.ok) {
        expect(extraRes.code).toBe('GAMES_EXTRA');
      }
    });

    it('confirm requires reported status (MATCH_NOT_REPORTED)', () => {
      const scheduledMatch = createBaseMatch({ status: 'scheduled' });
      const confirmedMatch = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 15],
          [21, 18],
        ],
      });

      expect(
        matchResultTransition(scheduledMatch, committeeActor, { type: 'confirm' }, bo3_21),
      ).toEqual({
        ok: false,
        code: 'MATCH_NOT_REPORTED',
        message: 'แมตช์ยังไม่ได้รายงานผล',
      });

      expect(
        matchResultTransition(confirmedMatch, committeeActor, { type: 'confirm' }, bo3_21),
      ).toEqual({
        ok: false,
        code: 'MATCH_NOT_REPORTED',
        message: 'แมตช์ยังไม่ได้รายงานผล',
      });
    });

    it('reject requires reported status and trimmed reason >= 5 (REASON_REQUIRED)', () => {
      const scheduledMatch = createBaseMatch({ status: 'scheduled' });
      expect(
        matchResultTransition(
          scheduledMatch,
          committeeActor,
          { type: 'reject', reason: 'valid reason' },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'MATCH_NOT_REPORTED',
        message: 'แมตช์ยังไม่ได้รายงานผล',
      });

      const reportedMatch = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
      });

      expect(
        matchResultTransition(
          reportedMatch,
          committeeActor,
          { type: 'reject', reason: '' },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'REASON_REQUIRED',
        message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
      });

      expect(
        matchResultTransition(
          reportedMatch,
          committeeActor,
          { type: 'reject', reason: '   bad  ' },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'REASON_REQUIRED',
        message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
      });
    });

    it('enter requires scheduled status (MATCH_NOT_SCHEDULED) and validates score', () => {
      const reportedMatch = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
      });
      expect(
        matchResultTransition(
          reportedMatch,
          committeeActor,
          {
            type: 'enter',
            games: [
              [21, 15],
              [21, 18],
            ],
          },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'MATCH_NOT_SCHEDULED',
        message: 'แมตช์ไม่ได้อยู่ในสถานะกำหนดการ',
      });

      const scheduledMatch = createBaseMatch();
      const invalidScoreRes = matchResultTransition(
        scheduledMatch,
        committeeActor,
        { type: 'enter', games: [[10, 10]] },
        bo3_21,
      );
      expect(invalidScoreRes.ok).toBe(false);
      if (!invalidScoreRes.ok) {
        expect(invalidScoreRes.code).toBe('GAME_SCORE_INVALID');
      }
    });

    it('correct requires confirmed status (MATCH_NOT_CONFIRMED)', () => {
      const scheduledMatch = createBaseMatch();
      expect(
        matchResultTransition(
          scheduledMatch,
          committeeActor,
          {
            type: 'correct',
            games: [
              [21, 15],
              [21, 18],
            ],
            reason: 'valid reason',
          },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'MATCH_NOT_CONFIRMED',
        message: 'แมตช์ยังไม่ได้รับการยืนยันผล',
      });
    });

    it('correct on a locked match returns MATCH_LOCKED', () => {
      const lockedMatch = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 15],
          [21, 18],
        ],
        locked: true,
      });

      const res = matchResultTransition(
        lockedMatch,
        committeeActor,
        {
          type: 'correct',
          games: [
            [21, 19],
            [21, 19],
          ],
          reason: 'พยายามแก้ไขแมตช์ที่ล็อกแล้ว',
        },
        bo3_21,
      );

      expect(res).toEqual({
        ok: false,
        code: 'MATCH_LOCKED',
        message: 'แมตช์ถูกล็อกแล้ว ไม่สามารถแก้ไขผลได้',
      });
    });

    it('correct requires trimmed reason >= 5 (REASON_REQUIRED) and validates score', () => {
      const confirmedMatch = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 15],
          [21, 18],
        ],
        locked: false,
      });

      expect(
        matchResultTransition(
          confirmedMatch,
          committeeActor,
          {
            type: 'correct',
            games: [
              [21, 15],
              [21, 18],
            ],
            reason: '   ',
          },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'REASON_REQUIRED',
        message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
      });

      expect(
        matchResultTransition(
          confirmedMatch,
          committeeActor,
          {
            type: 'correct',
            games: [
              [21, 15],
              [21, 18],
            ],
            reason: 'fail',
          },
          bo3_21,
        ),
      ).toEqual({
        ok: false,
        code: 'REASON_REQUIRED',
        message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
      });

      const invalidRes = matchResultTransition(
        confirmedMatch,
        committeeActor,
        { type: 'correct', games: [[20, 20]], reason: 'คะแนนผิด' },
        bo3_21,
      );
      expect(invalidRes.ok).toBe(false);
      if (!invalidRes.ok) {
        expect(invalidRes.code).toBe('GAME_SCORE_INVALID');
      }
    });
  });

  describe('Input object immutability', () => {
    it('never mutates input match object or internal arrays across all actions', () => {
      const scheduled = createBaseMatch({ flags: [] });
      const copy1 = structuredClone(scheduled);
      matchResultTransition(
        scheduled,
        umpireActor,
        {
          type: 'report',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );
      expect(scheduled).toEqual(copy1);

      const reported = createBaseMatch({
        status: 'reported',
        games: [
          [21, 15],
          [21, 18],
        ],
        reportedBy: 'umpire-1',
        flags: ['UMPIRE_TEAM_CONFLICT'],
      });
      const copy2 = structuredClone(reported);
      matchResultTransition(reported, committeeActor, { type: 'confirm' }, bo3_21);
      expect(reported).toEqual(copy2);

      const copy3 = structuredClone(reported);
      matchResultTransition(
        reported,
        committeeActor,
        { type: 'reject', reason: 'เหตุผลการตีกลับผล' },
        bo3_21,
      );
      expect(reported).toEqual(copy3);

      const copy4 = structuredClone(scheduled);
      matchResultTransition(
        scheduled,
        committeeActor,
        {
          type: 'enter',
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        bo3_21,
      );
      expect(scheduled).toEqual(copy4);

      const confirmed = createBaseMatch({
        status: 'confirmed',
        games: [
          [21, 15],
          [21, 18],
        ],
        version: 1,
        flags: ['COMMITTEE_DIRECT_ENTRY'],
      });
      const copy5 = structuredClone(confirmed);
      matchResultTransition(
        confirmed,
        committeeActor,
        {
          type: 'correct',
          games: [
            [21, 10],
            [21, 12],
          ],
          reason: 'แก้ไขผลการแข่งขัน',
        },
        bo3_21,
      );
      expect(confirmed).toEqual(copy5);
    });
  });
});
