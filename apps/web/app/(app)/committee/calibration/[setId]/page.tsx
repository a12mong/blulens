import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CalibrationDetail } from '@/features/calibration/CalibrationDetail';

interface Params {
  setId: string;
}

export default async function CommitteeCalibrationDetailPage(props: {
  params: Promise<Params>;
}) {
  const params = await props.params;

  if (process.env.NEXT_PUBLIC_CALIBRATION_UI === '0') {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link href="/committee/calibration" className="inline-flex min-h-[44px] items-center text-primary underline">
          ← ย้อนกลับ
        </Link>
        <h1 className="text-2xl font-bold text-foreground">ชุดคลิปมาตรฐาน</h1>
      </div>
      <CalibrationDetail setId={params.setId} />
    </div>
  );
}
