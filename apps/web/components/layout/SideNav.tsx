import Link from 'next/link';
import { navFor } from '@/lib/nav';
import type { Role } from '@/lib/roles';

export type SideNavProps = { roles: readonly Role[]; pathname: string };

export function SideNav({ roles, pathname }: SideNavProps) {
  return (
    <nav aria-label="เมนูหลัก" className="flex flex-col gap-1 p-2">
      {navFor(roles).map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded px-3 py-2 ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
