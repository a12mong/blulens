'use client';

import { EntryTable } from './EntryTable';
import { useEntries } from './api';

/** Read-only entries of an event for any logged-in user. The API returns only approved entries to non-admin/committee callers. */
export function EventEntries({ eventId }: { eventId: string }) {
  const { data, isPending, isError, error } = useEntries(eventId);
  if (isPending) return <p role="status">กำลังโหลด…</p>;
  if (isError) {
    return (
      <p role="alert" data-testid="event-entries-error">
        {error.message}
      </p>
    );
  }
  return <EntryTable entries={data ?? []} mode="committee" />;
}
