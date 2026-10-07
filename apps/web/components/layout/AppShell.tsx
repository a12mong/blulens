import type { ReactNode } from 'react';
import type { Role } from '@/lib/roles';
import { SideNav } from './SideNav';

export type AppShellProps = {
  roles: readonly Role[];
  displayName?: string;
  pathname: string;
  onLogout?: () => void;
  children: ReactNode;
};

export function AppShell({ roles, displayName, pathname, onLogout, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b md:w-56 md:border-b-0 md:border-r">
        <div className="p-3 font-bold">blulens</div>
        <SideNav roles={roles} pathname={pathname} />
        <div className="p-3 text-sm">
          {displayName ? <span>{displayName}</span> : null}
          {onLogout ? (
            <button type="button" onClick={onLogout} className="ml-2 underline">
              ออกจากระบบ
            </button>
          ) : null}
        </div>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
