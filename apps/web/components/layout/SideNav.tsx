import Link from 'next/link';
import { navFor } from '@/lib/nav';
import type { Role } from '@/lib/roles';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { notificationsEnabled } from '@/features/notifications/api';

export type SideNavProps = {
  roles: readonly Role[];
  pathname: string;
  isLoading?: boolean;
};

export function SideNav({ roles, pathname, isLoading = false }: SideNavProps) {
  if (isLoading) {
    return (
      <div
        data-testid="menu-skeleton"
        role="status"
        aria-label="กำลังโหลดเมนู"
        className="flex flex-col gap-2 p-2"
      >
        <span className="sr-only">กำลังโหลดเมนู</span>
        <div className="h-10 rounded bg-muted animate-pulse" />
        <div className="h-10 rounded bg-muted animate-pulse" />
        <div className="h-10 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <nav aria-label="เมนูหลัก" className="flex flex-col gap-1 p-2">
      {navFor(roles).map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href) || pathname.startsWith('/' + item.area);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 min-h-[44px] items-center rounded px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-foreground hover:bg-accent'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      {notificationsEnabled() && roles.length > 0 && <NotificationBell pathname={pathname} />}
    </nav>
  );
}
