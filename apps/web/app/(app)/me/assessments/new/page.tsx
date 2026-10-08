import React from 'react';
import { notFound } from 'next/navigation';
import { RequestAssessment } from '@/features/clips/RequestAssessment';

export default function Page() {
  if (process.env.NEXT_PUBLIC_UPLOAD_UI === '0') {
    notFound();
  }
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">ขอประเมินฝีมือ</h1>
      <RequestAssessment />
    </div>
  );
}
