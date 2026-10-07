import { EventEntries } from '@/features/entries/EventEntries';

export default async function EventEntriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">ผู้สมัครที่ได้รับอนุมัติ</h1>
      <EventEntries eventId={eventId} />
    </>
  );
}
