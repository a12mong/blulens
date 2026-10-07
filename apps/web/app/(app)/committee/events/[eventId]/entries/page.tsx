import React from 'react';
import { CommitteeQueue } from '@/features/entries/CommitteeQueue';

export default async function CommitteeEntriesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">คิวอนุมัติผู้สมัคร</h1>
      <CommitteeQueue eventId={eventId} />
    </div>
  );
}
