import type { components } from '@/lib/api/schema';

export type Entry = components['schemas']['Entry'];
export type WarningDetail = NonNullable<Entry['warningDetails']>[number];

const GENERIC_WARNING_TEXT: Record<string, string> = {
  MULTI_TEAM: 'ผู้เล่นสังกัดหลายสโมสร',
  NO_APPROVED_GRADE: 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ',
  GRADE_OUT_OF_BAND: 'เกรดอยู่นอกช่วงของประเภทนี้',
  FRESH_ASSESSMENT_REQUIRED: 'ต้องประเมินใหม่ก่อนลงแข่ง',
};

function formatDetail(detail: WarningDetail): string {
  const name = detail.displayName || 'ผู้เล่น';
  switch (detail.code) {
    case 'MULTI_TEAM': {
      const n = detail.teamNames?.length ?? 0;
      const clubs = (detail.teamNames ?? []).join(', ');
      return `${name} สังกัด ${n} สโมสร (${clubs})`;
    }
    case 'GRADE_OUT_OF_BAND': {
      return detail.gradeLabel
        ? `${name} เกรด ${detail.gradeLabel} อยู่นอกช่วงของประเภทนี้`
        : `${name} เกรดอยู่นอกช่วงของประเภทนี้`;
    }
    case 'NO_APPROVED_GRADE':
      return `${name} ยังไม่มีเกรดที่อนุมัติ`;
    case 'FRESH_ASSESSMENT_REQUIRED':
      return `${name} ต้องประเมินใหม่ก่อนลงแข่ง`;
    default:
      return GENERIC_WARNING_TEXT[detail.code] || detail.code;
  }
}

export function warningLines(entry: {
  warnings?: string[];
  warningDetails?: WarningDetail[];
}): string[] {
  const warnings = entry.warnings ?? [];
  const details = entry.warningDetails ?? [];

  if (warnings.length === 0 && details.length === 0) {
    return [];
  }

  if (warnings.length > 0) {
    const lines: string[] = [];
    for (const code of warnings) {
      const codeDetails = details.filter((d) => d.code === code);
      if (codeDetails.length > 0) {
        for (const detail of codeDetails) {
          lines.push(formatDetail(detail));
        }
      } else {
        lines.push(GENERIC_WARNING_TEXT[code] || code);
      }
    }
    return lines;
  }

  return details.map(formatDetail);
}
