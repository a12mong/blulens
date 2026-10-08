import React from 'react';
import { MyResults } from '@/features/me/MyResults';

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">ของฉัน</h1>
      <MyResults />
    </div>
  );
}
