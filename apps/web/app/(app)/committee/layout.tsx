import type { ReactNode } from 'react';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function Layout({ children }: { children: ReactNode }) {
  return <RoleGuard area="committee">{children}</RoleGuard>;
}
