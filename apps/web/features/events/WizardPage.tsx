'use client';

import { useRouter } from 'next/navigation';
import { useMe } from '@/features/auth/api';
import { CreateTournamentWizard } from './CreateTournamentWizard';

/** Committee only (API: POST /tournaments). Others see a notice instead of the wizard. */
export function WizardPage() {
  const router = useRouter();
  const { data: me, isPending } = useMe();
  if (isPending) return <p role="status">กำลังโหลด…</p>;
  if (!me?.roles.includes('Committee')) {
    return (
      <p role="alert" data-testid="wizard-forbidden">
        เฉพาะคณะกรรมการเท่านั้นที่สร้างทัวร์นาเมนต์ได้
      </p>
    );
  }
  return <CreateTournamentWizard onCreated={() => router.push('/events')} />;
}
