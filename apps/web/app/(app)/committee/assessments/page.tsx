import { CommitteeAssessments } from '@/features/assessments/CommitteeAssessments';

export default function CommitteeAssessmentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ผลประเมิน</h1>
      <CommitteeAssessments />
    </div>
  );
}
