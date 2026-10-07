import type { ReactNode } from 'react';
import { AuthedShell } from '@/components/layout/AuthedShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthedShell>{children}</AuthedShell>;
}
