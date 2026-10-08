import React from 'react';
import { notFound } from 'next/navigation';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';

export default function Page() {
  if (process.env.NEXT_PUBLIC_NOTIFICATIONS === '0') {
    notFound();
  }
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">การแจ้งเตือน</h1>
      <NotificationsPage />
    </div>
  );
}
