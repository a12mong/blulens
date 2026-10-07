import React from 'react';
import { TournamentList } from '@/features/events/TournamentList';

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">ทัวร์นาเมนต์</h1>
      <TournamentList />
    </div>
  );
}
