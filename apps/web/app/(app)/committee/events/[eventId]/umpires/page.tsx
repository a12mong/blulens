import { UmpireAssignment } from '@/features/umpires/UmpireAssignment';

interface UmpirePageProps {
  params: Promise<{ eventId: string }>;
}

export default async function UmpireAssignmentPage({ params }: UmpirePageProps) {
  const { eventId } = await params;
  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">มอบหมายกรรมการสนาม</h1>
      <UmpireAssignment eventId={eventId} />
    </div>
  );
}
