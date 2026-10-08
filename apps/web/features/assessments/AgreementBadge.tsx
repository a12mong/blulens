import { WarningIcon } from '@/components/ui/Icon';
import { type components } from '@/lib/api/schema';

type AgreementValue = components['schemas']['AgreementValue'];

interface AgreementBadgeProps {
  value: AgreementValue;
}

const bandLabels: Record<
  'poor' | 'fair' | 'moderate' | 'substantial' | 'almost_perfect' | 'insufficient',
  string
> = {
  poor: 'ต่ำมาก',
  fair: 'พอใช้',
  moderate: 'ปานกลาง',
  substantial: 'ดี',
  almost_perfect: 'ดีมาก',
  insufficient: '',
};

export function AgreementBadge({ value }: AgreementBadgeProps) {
  const { kappa, band } = value;
  const isInsufficient = kappa === null || kappa === undefined || band === 'insufficient';

  if (isInsufficient) {
    return (
      <span
        data-testid="agreement-badge"
        data-band={band}
        title="ข้อมูลร่วมไม่พอ"
      >
        —
        <span className="sr-only">ข้อมูลร่วมไม่พอ</span>
      </span>
    );
  }

  const hasWarning = band === 'poor' || band === 'fair';
  const kappaText = kappa.toFixed(2);
  const bandText = bandLabels[band as keyof typeof bandLabels];

  return (
    <span data-testid="agreement-badge" data-band={band}>
      {kappaText} {bandText}
      {hasWarning && <WarningIcon className="w-4 h-4 ml-1 inline" />}
    </span>
  );
}
