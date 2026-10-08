import React from 'react';
import { MyAssessmentDetail } from '@/features/me/MyAssessmentDetail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">คำขอประเมินของฉัน</h1>
      <MyAssessmentDetail id={id} />
    </div>
  );
}
