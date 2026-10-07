'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useMe } from '@/features/auth/api';
import { canAccess, type Area, type Role } from '@/lib/roles';

/** UX guard only: the API stays authoritative. Guest -> /login?next=..., wrong role -> 403 notice. */
export function RoleGuard({ area, children }: { area: Area; children: ReactNode }) {
  const { data: me, isPending } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isPending && !me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isPending, me, pathname, router]);

  if (isPending || !me) return <p role="status">กำลังโหลด…</p>;
  if (!canAccess(me.roles as Role[], area)) {
    return (
      <div role="alert">
        <h1 className="text-xl font-bold">403</h1>
        <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
      </div>
    );
  }
  return <>{children}</>;
}
