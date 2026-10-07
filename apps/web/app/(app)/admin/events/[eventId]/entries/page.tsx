import { AdminEntries } from '@/features/entries/AdminEntries';

interface EntriesPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EntriesPage({ params }: EntriesPageProps) {
  const { eventId } = await params;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">รายการคู่ผู้สมัคร</h1>
      <AdminEntries eventId={eventId} />
    </div>
  );
}
