import React from 'react';
import { StandingsPage } from '@/features/bracket/StandingsPage';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventStandingsPage({ params }: PageProps) {
  const { id } = await params;

  return <StandingsPage eventId={id} />;
}
