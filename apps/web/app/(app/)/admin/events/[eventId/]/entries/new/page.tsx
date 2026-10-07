'use client';

import { useParams, useRouter } from 'next/navigation';
import { AdminEntryForm } from '@/features/entries/AdminEntryForm';

export default function NewEntryPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">เพิ่มคู่ผู้สมัคร</h1>
      <AdminEntryForm
        eventId={eventId}
        onDone={() => {
          router.push(`/admin/events/${eventId}/entries`);
        }}
      />
    </div>
  );
}
