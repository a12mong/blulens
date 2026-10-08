'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { SideNav } from './SideNav';

export type AppShellProps = {
  roles: readonly Role[];
  displayName?: string;
  pathname: string;
  onLogout?: () => void;
  isLoading?: boolean;
  children: ReactNode;
};

export function AppShell({
  roles,
  displayName,
  pathname,
  onLogout,
  isLoading = false,
  children,
}: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Top bar on mobile (< 768px) */}
      <header className="flex h-14 items-center justify-between border-b px-4 md:hidden bg-card text-card-foreground">
        <div className="font-bold text-foreground">blulens</div>
        <button
          type="button"
          aria-label="เมนู"
          aria-expanded={isOpen}
          aria-controls="main-nav"
          data-testid="drawer-toggle"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex min-h-11 min-w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <span className="sr-only">เมนู</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Main navigation aside: acts as drawer when open on mobile, always visible on md+ */}
      <aside
        id="main-nav"
        className={`${
          isOpen ? 'block' : 'hidden'
        } border-b md:flex md:flex-col md:w-56 md:border-b-0 md:border-r bg-card text-card-foreground`}
      >
        <div className="hidden p-3 font-bold text-foreground md:block">blulens</div>
        <div className="flex-1">
          <SideNav roles={roles} pathname={pathname} isLoading={isLoading} />
        </div>

        {/* Account block apart from the menu */}
        {!isLoading && (displayName || roles.length > 0 || onLogout) && (
          <div data-testid="account-block" className="p-3 border-t text-sm space-y-1">
            {displayName && (
              <div data-testid="account-name" className="font-medium text-foreground">
                {displayName}
              </div>
            )}
            {roles.length > 0 && (
              <div data-testid="account-role" className="text-xs text-muted-foreground">
                {roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
              </div>
            )}
            {onLogout && (
              <div>
                <button
                  type="button"
                  data-testid="logout-button"
                  onClick={onLogout}
                  className="min-h-11 min-h-[44px] text-sm text-destructive hover:underline text-left inline-flex items-center cursor-pointer"
                >
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
