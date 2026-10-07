import React from 'react';
import { BracketPage } from '@/features/bracket/BracketPage';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fixture?: string }>;
}

export default async function EventBracketPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  return <BracketPage eventId={id} fixture={sp.fixture === '1'} />;
}
