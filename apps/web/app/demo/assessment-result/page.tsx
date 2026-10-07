import React from 'react';
import type { Metadata } from 'next';
import { AssessmentResultMock } from '@/features/demo/AssessmentResultMock';

export const metadata: Metadata = {
  title: 'ผลการประเมินฝีมือ (Demo) — BluLens',
  description: 'ตัวอย่างผลการประเมินระดับฝีมือนักกีฬาแบดมินตันด้วยระบบ BluLens',
};

export default function DemoAssessmentResultPage() {
  return <AssessmentResultMock />;
}
