import React from 'react';
import { RubricEditor } from '@/features/rubrics/RubricEditor';

export default async function Page({ params }: { params: Promise<{ rubricId: string }> }) {
  const { rubricId } = await params;
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">แก้ไขเกณฑ์</h1>
      <RubricEditor rubricId={rubricId} />
    </div>
  );
}
