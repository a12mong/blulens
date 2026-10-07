'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLogout, useMe } from '@/features/auth/api';
import type { Role } from '@/lib/roles';
import { AppShell } from './AppShell';

/** AppShell wired to the session: roles/name from useMe, logout then back to /login */
export function AuthedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();
  const logout = useLogout({ onSuccess: () => router.replace('/login') });
  return (
    <AppShell
      roles={(me?.roles ?? []) as Role[]}
      displayName={me?.displayName}
      pathname={pathname}
      onLogout={() => logout.mutate()}
    >
      {children}
    </AppShell>
  );
}
