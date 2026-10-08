import React from 'react';
import Link from 'next/link';
import { MyResults } from '@/features/me/MyResults';

export default function Page() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">ของฉัน</h1>
      {process.env.NEXT_PUBLIC_UPLOAD_UI === '1' && (
        <Link
          href="/me/assessments/new"
          data-testid="myresult-new"
          className="inline-flex items-center justify-center self-start min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm"
        >
          ขอประเมินใหม่
        </Link>
      )}
      <MyResults />
    </div>
  );
}
