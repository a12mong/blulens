'use client';

import { EntryTable } from './EntryTable';
import { useEntries, useForwardEntry } from './api';
import { useEvent } from '@/features/events/api';
import { useState } from 'react';
import type { components } from '@/lib/api/schema';

type Entry = components['schemas']['Entry'];
type EventDetail = components['schemas']['EventDetail'];

interface AdminEntriesProps {
  eventId: string;
}

export function AdminEntries({ eventId }: AdminEntriesProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  const eventQuery = useEvent(eventId);
  const entriesQuery = useEntries(eventId);
  const forwardMutation = useForwardEntry();

  const event = eventQuery.data as EventDetail | undefined;
  const entries = entriesQuery.data || [];

  const handleForward = (entry: Entry) => {
    setActionError(null);
    forwardMutation.mutate(
      { entryId: entry.id },
      {
        onError: (error: any) => {
          setActionError(error.message || 'ไม่สามารถส่งให้คณะกรรมการได้');
        },
      }
    );
  };

  const isOpen = event?.tournamentStatus === 'open';

  return (
    <div className="space-y-4">
      {/* Header */}
      {event && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{event.tournamentName}</h2>
          <p className="text-sm text-muted-foreground">
            {event.discipline} {event.gradeMin}–{event.gradeMax}
          </p>
        </div>
      )}

      {/* New Entry Link or Closed Notice */}
      <div>
        {isOpen ? (
          <a
            data-testid="entry-new"
            href={`/admin/events/${eventId}/entries/new`}
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            + เพิ่มคู่
          </a>
        ) : (
          <p role="alert" data-testid="entries-closed-notice" className="text-sm text-red-600">
            ต้องเปิดรับสมัครทัวร์นาเมนต์ก่อน
          </p>
        )}
      </div>

      {/* Forward Error Alert */}
      {actionError && (
        <p role="alert" data-testid="entries-action-error" className="text-sm text-red-600">
          {actionError}
        </p>
      )}

      {/* Entries Table */}
      <div>
        <EntryTable entries={entries} mode="admin" onForward={handleForward} />
      </div>
    </div>
  );
}

export default AdminEntries;
