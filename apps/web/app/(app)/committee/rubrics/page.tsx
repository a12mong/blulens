import React from 'react';
import { RubricList } from '@/features/rubrics/RubricList';

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">เกณฑ์การประเมิน (Rubric)</h1>
      <RubricList />
    </div>
  );
}
