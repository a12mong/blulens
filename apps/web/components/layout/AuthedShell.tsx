'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLogout, useMe } from '@/features/auth/api';
import type { Role } from '@/lib/roles';
import { AppShell } from './AppShell';

/** AppShell wired to the session: roles/name from useMe, logout then back to /login */
export function AuthedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isSuccess } = useMe();
  const logout = useLogout({ onSettled: () => router.replace('/login') });
  const cleared = useRef(false);

  // Stale session: the cookie exists (middleware let us in) but /auth/me says 401.
  // Clear the cookies server-side and go to /login instead of showing a half-logged-in shell.
  useEffect(() => {
    if (isSuccess && me === null && !cleared.current) {
      cleared.current = true;
      logout.mutate();
    }
  }, [isSuccess, me, logout]);

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
