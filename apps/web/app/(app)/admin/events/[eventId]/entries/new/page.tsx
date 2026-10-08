'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEvent } from '@/features/events/api';
import { AdminEntryForm } from '@/features/entries/AdminEntryForm';
import { thaiError } from '@/lib/errors';
import type { components } from '@/lib/api/schema';

type EventDetail = components['schemas']['EventDetail'];

const DISCIPLINE_TH: Record<string, string> = {
  MS: 'ชายเดี่ยว',
  WS: 'หญิงเดี่ยว',
  MD: 'ชายคู่',
  WD: 'หญิงคู่',
  XD: 'คู่ผสม',
};

export default function NewEntryPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const { data, isLoading, isError, error } = useEvent(eventId);
  const event = data as EventDetail | undefined;

  const eventName = event?.tournamentName ?? 'อีเวนต์';
  const category = event?.discipline
    ? DISCIPLINE_TH[event.discipline] ?? event.discipline
    : '';
  const gradeRange =
    event?.gradeMin && event?.gradeMax
      ? `${event.gradeMin}–${event.gradeMax}`
      : '';
  const details = [category, gradeRange].filter(Boolean).join(' ');
  const headerText = `เพิ่มคู่: ${eventName}${details ? ` · ${details}` : ''}`;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <Link
          href={`/admin/events/${eventId}/entries`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          ← กลับไปรายการผู้สมัคร
        </Link>
      </div>

      {isLoading ? (
        <div data-testid="new-entry-loading" className="space-y-4 animate-pulse">
          <div className="h-8 w-72 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-48" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          data-testid="new-entry-error"
          className="p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm"
        >
          {thaiError(error, 'เกิดข้อผิดพลาดในการโหลดข้อมูลอีเวนต์')}
        </div>
      ) : (
        <h1
          className="text-2xl font-bold text-foreground"
          data-testid="new-entry-header"
        >
          {headerText}
        </h1>
      )}

      <AdminEntryForm
        eventId={eventId}
        onDone={() => {
          router.push(`/admin/events/${eventId}/entries`);
        }}
      />
    </div>
  );
}
