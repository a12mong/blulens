import React from 'react';
import { TeamRequestsQueue } from '@/features/teams/TeamRequestsQueue';

export default function CommitteeTeamRequestsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">คำขอสร้างทีม</h1>
      <TeamRequestsQueue />
    </div>
  );
}
