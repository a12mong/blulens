import React from 'react';
import { AssessmentDetailView } from '@/features/assessments/AssessmentDetailView';

export default async function CommitteeAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssessmentDetailView id={id} />;
}
