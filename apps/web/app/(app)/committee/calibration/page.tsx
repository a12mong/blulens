import React from 'react';
import { notFound } from 'next/navigation';
import { CalibrationSets } from '@/features/calibration/CalibrationSets';

export default function CommitteeCalibrationPage() {
  if (process.env.NEXT_PUBLIC_CALIBRATION_UI === '0') {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">ชุดคลิปมาตรฐาน</h1>
      <CalibrationSets />
    </div>
  );
}
