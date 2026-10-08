'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { BellIcon } from '@/components/ui/Icon';
import { unreadCountKey, useUnreadCount } from './api';

export function formatBadge(n: number): string {
  return n > 9 ? '9+' : String(n);
}

export function NotificationBell({ pathname }: { pathname: string }) {
  const { data: count = 0 } = useUnreadCount();
  const queryClient = useQueryClient();

  // refresh the count after every navigation
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: unreadCountKey });
  }, [pathname, queryClient]);

  return (
    <Link
      href="/notifications"
      data-testid="notification-bell"
      aria-label={count > 0 ? `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ` : 'การแจ้งเตือน'}
      className="flex min-h-[44px] items-center gap-2 rounded px-3 py-2 text-sm text-foreground hover:bg-accent"
    >
      <BellIcon className="w-5 h-5" />
      <span>แจ้งเตือน</span>
      {count > 0 && (
        <span
          data-testid="notification-badge"
          className="ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground"
        >
          {formatBadge(count)}
        </span>
      )}
    </Link>
  );
}
