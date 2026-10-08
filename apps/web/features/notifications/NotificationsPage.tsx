'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { thaiError } from '@/lib/errors';
import { useMarkAllRead, useMarkRead, useNotifications, type Notification } from './api';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  if (isLoading) {
    return (
      <div role="status" data-testid="notif-loading" className="p-6 text-center text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" data-testid="notif-error" className="p-6 border border-destructive rounded-lg bg-destructive/10 space-y-3">
        <p className="text-destructive font-medium">{thaiError(error, 'โหลดการแจ้งเตือนไม่สำเร็จ')}</p>
        <button type="button" onClick={() => refetch()} className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md">
          ลองใหม่
        </button>
      </div>
    );
  }

  const items: Notification[] = (data?.pages ?? []).flatMap((p) => p?.items ?? []);
  const unreadCount = data?.pages?.[0]?.unreadCount ?? 0;

  const open = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await markRead.mutateAsync(n.id);
      } catch {
        // still navigate; the count refreshes on the next poll
      }
    }
    if (n.link && n.link.startsWith('/')) router.push(n.link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p data-testid="notif-unread" className="text-sm text-muted-foreground">
          ยังไม่อ่าน {unreadCount} รายการ
        </p>
        <button
          type="button"
          data-testid="notif-read-all"
          onClick={() => markAll.mutate()}
          disabled={unreadCount === 0 || markAll.isPending}
          className="min-h-[44px] px-4 py-2 border border-border rounded-md text-sm font-medium disabled:opacity-50"
        >
          อ่านทั้งหมด
        </button>
      </div>

      {items.length === 0 ? (
        <p data-testid="notif-empty" className="p-8 text-center text-muted-foreground border border-border rounded-lg bg-card">
          ยังไม่มีการแจ้งเตือน
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                data-testid="notif-item"
                data-unread={n.readAt ? 'false' : 'true'}
                onClick={() => open(n)}
                className="w-full min-h-[44px] text-left p-4 border border-border rounded-lg bg-card hover:bg-muted space-y-1"
              >
                <span className={`block text-sm ${n.readAt ? '' : 'font-bold'}`}>
                  {!n.readAt && <span className="sr-only">ยังไม่อ่าน: </span>}
                  {n.title}
                </span>
                {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                <span className="block text-xs text-muted-foreground">{formatWhen(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            data-testid="notif-load-more"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="min-h-[44px] px-6 py-2 border border-border rounded-md text-sm font-medium disabled:opacity-50"
          >
            โหลดเพิ่ม
          </button>
        </div>
      )}
    </div>
  );
}
