'use client';

import { ApiRequestError } from '@/lib/api/client';
import { useState } from 'react';
import { useCreateTournament } from './api';
import type { components } from '@/lib/api/schema';

type Tournament = components['schemas']['Tournament'];

interface CreateTournamentFormProps {
  onCreated?: (tournament: Tournament) => void;
}

export function CreateTournamentForm({ onCreated }: CreateTournamentFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutate, isPending } = useCreateTournament({
    onSuccess: (tournament) => {
      setFormError(null);
      setValidationError(null);
      // Reset form by reloading
      const form = document.querySelector('form[data-testid="tournament-form"]') as HTMLFormElement;
      form?.reset();
      onCreated?.(tournament);
    },
    onError: (error: ApiRequestError) => {
      setValidationError(null);
      setFormError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setValidationError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get('name') as string;
    const venue = (formData.get('venue') as string) || '';
    const startsOn = formData.get('startsOn') as string;
    const entriesCloseAtLocal = formData.get('entriesCloseAt') as string;

    // Convert datetime-local to ISO UTC
    const entriesCloseAt = new Date(entriesCloseAtLocal).toISOString();
    const startDateEndOfDay = new Date(startsOn);
    startDateEndOfDay.setHours(23, 59, 59, 999);

    // Client validation: entries close must be before start date end-of-day
    if (new Date(entriesCloseAt) > startDateEndOfDay) {
      setValidationError('ปิดรับสมัครต้องก่อนวันแข่ง');
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      startsOn,
      entriesCloseAt,
    };

    // Only include venue if not empty
    if (venue) {
      payload.venue = venue;
    }

    mutate(payload as any);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="tournament-form" className="space-y-4">
      <div>
        <label htmlFor="tournament-name" className="block text-sm font-medium">
          ชื่อการแข่งขัน *
        </label>
        <input
          id="tournament-name"
          data-testid="tournament-name"
          type="text"
          name="name"
          required
          maxLength={80}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="tournament-venue" className="block text-sm font-medium">
          สนาม
        </label>
        <input
          id="tournament-venue"
          data-testid="tournament-venue"
          type="text"
          name="venue"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="tournament-starts-on" className="block text-sm font-medium">
          วันแข่ง *
        </label>
        <input
          id="tournament-starts-on"
          data-testid="tournament-starts-on"
          type="date"
          name="startsOn"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="tournament-entries-close" className="block text-sm font-medium">
          ปิดรับสมัคร *
        </label>
        <input
          id="tournament-entries-close"
          data-testid="tournament-entries-close"
          type="datetime-local"
          name="entriesCloseAt"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      {validationError && (
        <p role="alert" data-testid="tournament-error" className="text-red-600">
          {validationError}
        </p>
      )}

      {formError && (
        <p role="alert" data-testid="tournament-error" className="text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        data-testid="tournament-submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        สร้างการแข่งขัน
      </button>
    </form>
  );
}
