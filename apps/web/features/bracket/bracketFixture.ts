import type { BracketRound } from './Bracket';

export const bracketFixture: BracketRound[] = [
  {
    round: 1,
    matches: [
      {
        matchNo: 1,
        top: 'E1',
        bottom: 'E2',
        topEntry: {
          entryId: 'E1',
          displayName: 'สมชาย / วิภา',
          teamNames: ['สิงห์ แบดมินตัน'],
        },
        bottomEntry: {
          entryId: 'E2',
          displayName: 'อนันต์ / มาลี',
          teamNames: ['เชียงใหม่ แบด'],
        },
        winner: 'E1',
        status: 'confirmed',
      },
      {
        matchNo: 2,
        top: 'E3',
        bottom: null,
        topEntry: {
          entryId: 'E3',
          displayName: 'กิตติ / สุชาติ',
          teamNames: ['บีจี สปอร์ต'],
        },
        bottomEntry: null,
        winner: 'E3',
        status: 'bye',
      },
      {
        matchNo: 3,
        top: 'E4',
        bottom: 'E5',
        topEntry: {
          entryId: 'E4',
          displayName: 'ธีรเดช / นารี',
          teamNames: ['ภูเก็ต บียอนด์'],
        },
        bottomEntry: {
          entryId: 'E5',
          displayName: 'ปรีชา / ดวงใจ',
          teamNames: ['รัชดา อารีน่า'],
        },
        winner: 'E4',
        status: 'confirmed',
      },
      {
        matchNo: 4,
        top: 'E6',
        bottom: 'E7',
        topEntry: {
          entryId: 'E6',
          displayName: 'วรพจน์ / สุดา',
          teamNames: ['เมืองทอง คลับ'],
        },
        bottomEntry: {
          entryId: 'E7',
          displayName: 'ชัชชัย / กานดา',
          teamNames: ['เอสซีจี แบด'],
        },
        winner: 'E6',
        status: 'confirmed',
      },
    ],
  },
  {
    round: 2,
    matches: [
      {
        matchNo: 5,
        top: 'E1',
        bottom: 'E3',
        topEntry: {
          entryId: 'E1',
          displayName: 'สมชาย / วิภา',
          teamNames: ['สิงห์ แบดมินตัน'],
        },
        bottomEntry: {
          entryId: 'E3',
          displayName: 'กิตติ / สุชาติ',
          teamNames: ['บีจี สปอร์ต'],
        },
        winner: 'E1',
        status: 'reported',
      },
      {
        matchNo: 6,
        top: 'E4',
        bottom: 'E6',
        topEntry: {
          entryId: 'E4',
          displayName: 'ธีรเดช / นารี',
          teamNames: ['ภูเก็ต บียอนด์'],
        },
        bottomEntry: {
          entryId: 'E6',
          displayName: 'วรพจน์ / สุดา',
          teamNames: ['เมืองทอง คลับ'],
        },
        winner: null,
        status: 'scheduled',
      },
    ],
  },
  {
    round: 3,
    matches: [
      {
        matchNo: 7,
        top: null,
        bottom: null,
        topEntry: null,
        bottomEntry: null,
        winner: null,
        status: 'scheduled',
      },
    ],
  },
];

export const sampleBracketRounds = bracketFixture;
