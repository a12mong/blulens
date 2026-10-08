import React from 'react';
import { GroupDraw } from '@/features/draw/GroupDraw';

export default async function CommitteeGroupsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <GroupDraw eventId={eventId} />
    </div>
  );
}
