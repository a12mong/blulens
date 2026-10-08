import type { GradeKey, Tier } from '@/components/ui/GradeBand';

export type DemoStateKey = 'approved' | 'provisional' | 'disputed';

export type CriterionScore = {
  key: string;
  nameTh: string;
  gradeKey: string;
  score: number;
};

export type ReviewerReview = {
  id: string;
  code: string;
  name: string;
  overall: number;
  gradeNear: string;
  used: boolean;
  isOutlier?: boolean;
  outlierNote?: string;
  criteria: CriterionScore[];
};

export type KappaPair = {
  pair: string;
  kappa: number;
  label: string;
};

export type HowToStep = {
  step: number;
  title: string;
  description: string;
};

export type AssessmentStateData = {
  statusKey: DemoStateKey;
  statusLabel: string;
  statusChip: string;
  statusClass: string;
  banner?: string;
  reviewerSummary: string;
  grade: {
    label: string;
    subtitle: string;
    score: number;
    maxScore: number;
    lower: GradeKey;
    upper: GradeKey;
    margin: number;
    tier: Tier;
    kind: 'straddle' | 'exact' | 'wide';
    explanation: string;
  };
  reviewers: ReviewerReview[];
  agreement: {
    kappa: number | null;
    label: string;
    assessedCount: number;
    totalCount: number;
    pairs: KappaPair[];
    bias?: string;
    note: string;
  };
  howCalculated: HowToStep[];
};

export type DemoAssessmentPayload = {
  player: {
    name: string;
    club: string;
    code: string;
  };
  date: string;
  clip: {
    title: string;
    duration: string;
    caption: string;
  };
  footerNote: string;
  states: Record<DemoStateKey, AssessmentStateData>;
};

export const DEMO_DATA: DemoAssessmentPayload = {
  player: {
    name: 'ธนกร ใจดี',
    club: 'เชียงใหม่ แบด',
    code: 'ASM-2026-0142',
  },
  date: '7 ต.ค. 2569',
  clip: {
    title: 'คลิปที่ใช้ประเมิน',
    duration: '0:47',
    caption: '1 คลิป · ตรวจโดยกรรมการ 3 คน (แบบ blind: กรรมการไม่เห็นชื่อผู้เล่น)',
  },
  footerNote: 'ข้อมูลตัวอย่างสำหรับการนำเสนอระบบประเมินฝีมือนักกีฬา · BluLens',
  states: {
    approved: {
      statusKey: 'approved',
      statusLabel: 'อนุมัติแล้ว',
      statusChip: '✓ อนุมัติแล้ว',
      statusClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      reviewerSummary: 'กรรมการ 3 คน (ใช้ 2 · ตัดออก 1)',
      grade: {
        label: 'S-/S',
        subtitle: 'เกรดอยู่ระหว่าง S- ถึง S',
        score: 7.42,
        maxScore: 15,
        lower: 'S-',
        upper: 'S',
        margin: 0.5,
        tier: 'Standard',
        kind: 'straddle',
        explanation:
          'ระดับฝีมืออยู่ในช่วง Standard (S- ถึง S) มีความแม่นยำและการคุมเกมสม่ำเสมอ คะแนนเฉลี่ย 7.42 ± 0.50 เหมาะสำหรับแข่งขันในดิวิชัน S- ถึง S',
      },
      reviewers: [
        {
          id: 'r1',
          code: 'R1',
          name: 'กรรมการ A',
          overall: 7.5,
          gradeNear: '≈ S',
          used: true,
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', gradeKey: 'S', score: 7.5 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', gradeKey: 'S+', score: 8.5 },
            { key: 'net', nameTh: 'หน้าตาข่าย', gradeKey: 'S', score: 7.5 },
            { key: 'defense', nameTh: 'การรับ', gradeKey: 'S-', score: 6.5 },
            { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', gradeKey: 'S', score: 7.5 },
            { key: 'consistency', nameTh: 'ความสม่ำเสมอ', gradeKey: 'S', score: 7.5 },
          ],
        },
        {
          id: 'r2',
          code: 'R2',
          name: 'กรรมการ B',
          overall: 7.33,
          gradeNear: '≈ S',
          used: true,
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', gradeKey: 'S', score: 7.5 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', gradeKey: 'S', score: 7.5 },
            { key: 'net', nameTh: 'หน้าตาข่าย', gradeKey: 'S-', score: 6.5 },
            { key: 'defense', nameTh: 'การรับ', gradeKey: 'S-', score: 6.5 },
            { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', gradeKey: 'S+', score: 8.5 },
            { key: 'consistency', nameTh: 'ความสม่ำเสมอ', gradeKey: 'S', score: 7.5 },
          ],
        },
        {
          id: 'r3',
          code: 'R3',
          name: 'กรรมการ C',
          overall: 9.83,
          gradeNear: '≈ N-/N',
          used: false,
          isOutlier: true,
          outlierNote: 'ห่างจากกรรมการส่วนใหญ่ 2.33 ขั้น (เกณฑ์ 2.0) · robustZ 9.2',
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', gradeKey: 'N-', score: 9.5 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', gradeKey: 'N', score: 10.5 },
            { key: 'net', nameTh: 'หน้าตาข่าย', gradeKey: 'N-', score: 9.5 },
            { key: 'defense', nameTh: 'การรับ', gradeKey: 'N-', score: 9.5 },
            { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', gradeKey: 'N', score: 10.5 },
            { key: 'consistency', nameTh: 'ความสม่ำเสมอ', gradeKey: 'N-', score: 9.5 },
          ],
        },
      ],
      agreement: {
        kappa: 0.68,
        label: 'ดี',
        assessedCount: 2,
        totalCount: 3,
        pairs: [
          { pair: 'คู่ A–B', kappa: 0.78, label: 'ดี' },
          { pair: 'คู่ A–C', kappa: 0.41, label: 'ปานกลาง' },
          { pair: 'คู่ B–C', kappa: 0.38, label: 'พอใช้' },
        ],
        bias: 'กรรมการ C มี bias +0.9 ขั้น (ให้สูงกว่าฉันทามติ)',
        note: 'Kappa ใช้วัดความสอดคล้องของกรรมการ ไม่ใช่คะแนนของผู้เล่น และไม่เข้าสูตรคำนวณเกรด',
      },
      howCalculated: [
        {
          step: 1,
          title: 'กรรมการเลือกขั้น',
          description:
            'กรรมการแต่ละคนดูคลิปแล้วเลือกขั้นเกรด (RK1–P+) ต่อ 6 หัวข้อการเล่น',
        },
        {
          step: 2,
          title: 'ตัดคะแนนโดด (Outlier)',
          description:
            'คะแนนที่ห่างจากมัธยฐานเกิน 2 ขั้นและผิดปกติทางสถิติ (z > 3.5) จะถูกตัดออก: ครั้งนี้ตัดกรรมการ C',
        },
        {
          step: 3,
          title: 'เฉลี่ยที่เหลือ',
          description:
            'นำคะแนนกรรมการที่ผ่านเกณฑ์มาเฉลี่ย: (7.50 + 7.33) ÷ 2 = 7.42',
        },
        {
          step: 4,
          title: 'ช่วงความมั่นใจบนบันได',
          description:
            'คำนวณระยะความเชื่อมั่น ± 0.50 ขั้น → ช่วง 6.92–7.92 → แสดงผลเป็นเกรด S-/S',
        },
      ],
    },
    provisional: {
      statusKey: 'provisional',
      statusLabel: 'ชั่วคราว (กรรมการ 1 คน)',
      statusChip: '◔ ชั่วคราว · กรรมการ 1 คน',
      statusClass: 'bg-amber-100 text-amber-900 border-amber-300',
      banner:
        'ผลชั่วคราวจากกรรมการ 1 คน รอ Committee ยืนยัน — ยังใช้สมัคร/จัดสายไม่ได้',
      reviewerSummary: 'กรรมการ 1 คน (รอตรวจเพิ่ม 2 คน)',
      grade: {
        label: 'S-–S+',
        subtitle: 'ช่วงผลชั่วคราว S- ถึง S+',
        score: 7.5,
        maxScore: 15,
        lower: 'S-',
        upper: 'S+',
        margin: 1.0,
        tier: 'Standard',
        kind: 'wide',
        explanation:
          'ผลการประเมินเบื้องต้นจากกรรมการท่านแรก ช่วงความเชื่อมั่นกว้าง ±1.00 ขั้น (S- ถึง S+) จะแคบลงเมื่อมีกรรมการครบ',
      },
      reviewers: [
        {
          id: 'r1',
          code: 'R1',
          name: 'กรรมการ A',
          overall: 7.5,
          gradeNear: '≈ S',
          used: true,
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', gradeKey: 'S', score: 7.5 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', gradeKey: 'S+', score: 8.5 },
            { key: 'net', nameTh: 'หน้าตาข่าย', gradeKey: 'S', score: 7.5 },
            { key: 'defense', nameTh: 'การรับ', gradeKey: 'S-', score: 6.5 },
            { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', gradeKey: 'S', score: 7.5 },
            { key: 'consistency', nameTh: 'ความสม่ำเสมอ', gradeKey: 'S', score: 7.5 },
          ],
        },
      ],
      agreement: {
        kappa: null,
        label: 'ข้อมูลไม่พอ',
        assessedCount: 1,
        totalCount: 1,
        pairs: [],
        note: 'ต้องการกรรมการอย่างน้อย 2 คนเพื่อคำนวณดัชนีความสอดคล้อง',
      },
      howCalculated: [
        {
          step: 1,
          title: 'กรรมการท่านแรกส่งคะแนน',
          description: 'ประเมิน 6 ทักษะ ได้คะแนนเฉลี่ยเบื้องต้น 7.50',
        },
        {
          step: 2,
          title: 'ขยายช่วงความเชื่อมั่น',
          description: 'กำหนด Margin กว้างพิเศษ ±1.00 ขั้น เนื่องจากมีเพียง 1 ผู้ประเมิน',
        },
        {
          step: 3,
          title: 'แสดงเกรดชั่วคราว',
          description: 'เกรดช่วงกว้าง S-–S+ ครอบคลุม 3 ขั้น (S-, S, S+)',
        },
        {
          step: 4,
          title: 'รอการยืนยัน',
          description: 'ส่งคลิปให้กรรมการท่านที่ 2 และ 3 ประเมินเพื่อสรุปผลทางการ',
        },
      ],
    },
    disputed: {
      statusKey: 'disputed',
      statusLabel: 'เห็นต่างกันมาก',
      statusChip: 'เห็นต่างกันมาก',
      statusClass: 'bg-rose-100 text-rose-900 border-rose-300',
      banner:
        'กรรมการเห็นต่างกันมาก — รอ Committee ตัดสินและอาจเพิ่มกรรมการคนที่ 3',
      reviewerSummary: 'กรรมการ 2 คน (คะแนนห่างกัน 2.50 ขั้น > เกณฑ์ 2.0)',
      grade: {
        label: 'S-–N-',
        subtitle: 'ช่วงผลรอตัดสิน S- ถึง N-',
        score: 7.75,
        maxScore: 15,
        lower: 'S-',
        upper: 'N-',
        margin: 1.5,
        tier: 'Standard',
        kind: 'wide',
        explanation:
          'กรรมการประเมินต่างกันเกิน 2 ขั้น (6.50 vs 9.00) ระบบส่งผลให้คณะกรรมการกลางพิจารณาตัดสิน',
      },
      reviewers: [
        {
          id: 'r1',
          code: 'R1',
          name: 'กรรมการ A',
          overall: 6.5,
          gradeNear: '≈ S-',
          used: true,
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', gradeKey: 'S-', score: 6.5 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', gradeKey: 'S-', score: 6.5 },
            { key: 'net', nameTh: 'หน้าตาข่าย', gradeKey: 'S-', score: 6.5 },
            { key: 'defense', nameTh: 'การรับ', gradeKey: 'BG3', score: 5.5 },
            { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', gradeKey: 'S-', score: 6.5 },
            { key: 'consistency', nameTh: 'ความสม่ำเสมอ', gradeKey: 'S-', score: 6.5 },
          ],
        },
        {
          id: 'r2',
          code: 'R2',
          name: 'กรรมการ B',
          overall: 9.0,
          gradeNear: '≈ N-',
          used: true,
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', gradeKey: 'N-', score: 9.5 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', gradeKey: 'N-', score: 9.5 },
            { key: 'net', nameTh: 'หน้าตาข่าย', gradeKey: 'S+', score: 8.5 },
            { key: 'defense', nameTh: 'การรับ', gradeKey: 'N-', score: 9.5 },
            { key: 'tactics', nameTh: 'การอ่านเกม/แท็กติก', gradeKey: 'N-', score: 9.5 },
            { key: 'consistency', nameTh: 'ความสม่ำเสมอ', gradeKey: 'S+', score: 8.5 },
          ],
        },
      ],
      agreement: {
        kappa: 0.38,
        label: 'พอใช้',
        assessedCount: 2,
        totalCount: 2,
        pairs: [{ pair: 'คู่ A–B', kappa: 0.38, label: 'พอใช้' }],
        note: 'ความสอดคล้องต่ำกว่าเกณฑ์ปกติ คณะกรรมการจะแต่งตั้งกรรมการท่านที่ 3 เพื่อสอบทาน',
      },
      howCalculated: [
        {
          step: 1,
          title: 'ประเมิน 2 ท่านแรก',
          description: 'กรรมการ A ให้ 6.50 (S-) ส่วนกรรมการ B ให้ 9.00 (N-)',
        },
        {
          step: 2,
          title: 'ตรวจจับความขัดแย้ง',
          description: 'คะแนนห่างกัน 2.50 ขั้น เกินเกณฑ์มาตรฐาน 2.0 ขั้น',
        },
        {
          step: 3,
          title: 'คำนวณช่วงกว้าง',
          description: 'เฉลี่ย 7.75 ระยะเผื่อ ±1.50 ขั้น ได้ช่วงกว้าง S- ถึง N-',
        },
        {
          step: 4,
          title: 'ส่งต่อ Committee',
          description: 'ระบบตั้งสถานะ Disputed เพื่อให้คณะกรรมการชี้ขาด',
        },
      ],
    },
  },
};
