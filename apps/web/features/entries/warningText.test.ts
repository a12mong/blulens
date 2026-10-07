import { describe, expect, it } from 'vitest';
import { warningLines, type WarningDetail } from './warningText';

describe('warningLines', () => {
  it('names the player and clubs for a multi-club warning and falls back to the generic text', () => {
    const withDetails = warningLines({
      warnings: ['MULTI_TEAM'],
      warningDetails: [
        {
          code: 'MULTI_TEAM',
          displayName: 'สมชาย',
          teamNames: ['A', 'B'],
        },
      ],
    });
    expect(withDetails).toEqual(['สมชาย สังกัด 2 สโมสร (A, B)']);

    const withoutDetails = warningLines({
      warnings: ['MULTI_TEAM'],
    });
    expect(withoutDetails).toEqual(['ผู้เล่นสังกัดหลายสโมสร']);
  });

  it('out-of-band line includes the grade label and falls back to generic text', () => {
    const withDetails = warningLines({
      warnings: ['GRADE_OUT_OF_BAND'],
      warningDetails: [
        {
          code: 'GRADE_OUT_OF_BAND',
          displayName: 'สมชาย',
          gradeLabel: 'S+',
        },
      ],
    });
    expect(withDetails).toEqual(['สมชาย เกรด S+ อยู่นอกช่วงของประเภทนี้']);

    const withoutDetails = warningLines({
      warnings: ['GRADE_OUT_OF_BAND'],
    });
    expect(withoutDetails).toEqual(['เกรดอยู่นอกช่วงของประเภทนี้']);
  });

  it('two players with the same warning give two lines', () => {
    const details: WarningDetail[] = [
      {
        code: 'MULTI_TEAM',
        displayName: 'สมชาย',
        teamNames: ['A', 'B'],
      },
      {
        code: 'MULTI_TEAM',
        displayName: 'วิภา',
        teamNames: ['C', 'D'],
      },
    ];

    const lines = warningLines({
      warnings: ['MULTI_TEAM'],
      warningDetails: details,
    });

    expect(lines).toEqual([
      'สมชาย สังกัด 2 สโมสร (A, B)',
      'วิภา สังกัด 2 สโมสร (C, D)',
    ]);
  });

  it('formats NO_APPROVED_GRADE with and without details', () => {
    const withDetails = warningLines({
      warnings: ['NO_APPROVED_GRADE'],
      warningDetails: [
        {
          code: 'NO_APPROVED_GRADE',
          displayName: 'อนันต์',
        },
      ],
    });
    expect(withDetails).toEqual(['อนันต์ ยังไม่มีเกรดที่อนุมัติ']);

    const withoutDetails = warningLines({
      warnings: ['NO_APPROVED_GRADE'],
    });
    expect(withoutDetails).toEqual(['ผู้เล่นยังไม่มีเกรดที่อนุมัติ']);
  });

  it('formats FRESH_ASSESSMENT_REQUIRED with and without details', () => {
    const withDetails = warningLines({
      warnings: ['FRESH_ASSESSMENT_REQUIRED'],
      warningDetails: [
        {
          code: 'FRESH_ASSESSMENT_REQUIRED',
          displayName: 'กานดา',
        },
      ],
    });
    expect(withDetails).toEqual(['กานดา ต้องประเมินใหม่ก่อนลงแข่ง']);

    const withoutDetails = warningLines({
      warnings: ['FRESH_ASSESSMENT_REQUIRED'],
    });
    expect(withoutDetails).toEqual(['ต้องประเมินใหม่ก่อนลงแข่ง']);
  });

  it('returns empty array when neither warnings nor details exist', () => {
    expect(warningLines({})).toEqual([]);
    expect(warningLines({ warnings: [] })).toEqual([]);
    expect(warningLines({ warnings: [], warningDetails: [] })).toEqual([]);
  });

  it('preserves order of warnings when multiple mixed warnings exist', () => {
    const lines = warningLines({
      warnings: ['MULTI_TEAM', 'NO_APPROVED_GRADE', 'GRADE_OUT_OF_BAND'],
      warningDetails: [
        {
          code: 'MULTI_TEAM',
          displayName: 'สมชาย',
          teamNames: ['สโมสร 1'],
        },
        {
          code: 'GRADE_OUT_OF_BAND',
          displayName: 'วิภา',
          gradeLabel: 'RK1',
        },
      ],
    });

    expect(lines).toEqual([
      'สมชาย สังกัด 1 สโมสร (สโมสร 1)',
      'ผู้เล่นยังไม่มีเกรดที่อนุมัติ',
      'วิภา เกรด RK1 อยู่นอกช่วงของประเภทนี้',
    ]);
  });
});
