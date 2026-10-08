import React from 'react';
import { ResultsQueue } from '@/features/results/ResultsQueue';

export default async function CommitteeResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">ผลการแข่งขันรอยืนยัน</h1>
      <ResultsQueue eventId={eventId} />
    </div>
  );
}
