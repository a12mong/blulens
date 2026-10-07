import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { apiFetch, ApiRequestError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { FORMAT_PRESETS, type FormatPresetKey } from './formatPresets';
import { tournamentsKey } from './api';

type Tournament = components['schemas']['Tournament'];
type TournamentInput = components['schemas']['TournamentInput'];
type EventInput = components['schemas']['EventInput'];
type Event = components['schemas']['Event'];

export type WizardEvent = EventInput & { formatPreset: FormatPresetKey };
export type WizardInput = { tournament: TournamentInput; events: WizardEvent[] };
export type WizardResult = { tournament: Tournament; events: Event[] };

/** thrown when the tournament exists but a later step failed: the page can tell the user it is saved as a draft */
export class PartialCreateError extends Error {
  constructor(
    message: string,
    readonly tournament: Tournament,
  ) {
    super(message);
    this.name = 'PartialCreateError';
  }
}

/** POST tournament, then each event, then PUT each event's format preset. Server decides validity; we only sequence. */
export async function createTournamentWithEvents({ tournament, events }: WizardInput): Promise<WizardResult> {
  const created = await apiFetch<Tournament>('/tournaments', { method: 'POST', body: tournament });
  const createdEvents: Event[] = [];
  try {
    for (const { formatPreset, ...eventBody } of events) {
      const ev = await apiFetch<Event>(`/tournaments/${created.id}/events`, { method: 'POST', body: eventBody });
      await apiFetch(`/events/${ev.id}/format`, { method: 'PUT', body: FORMAT_PRESETS[formatPreset].format });
      createdEvents.push(ev);
    }
  } catch (e) {
    const msg = e instanceof ApiRequestError ? e.message : 'เพิ่มอีเวนต์ไม่สำเร็จ';
    throw new PartialCreateError(`สร้างทัวร์นาเมนต์แล้ว (ร่าง) แต่เพิ่มอีเวนต์ไม่สำเร็จ: ${msg}`, created);
  }
  return { tournament: created, events: createdEvents };
}

export function useCreateTournamentWithEvents(
  options?: Omit<UseMutationOptions<WizardResult, Error, WizardInput>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTournamentWithEvents,
    ...options,
    onSettled: (...args) => {
      void queryClient.invalidateQueries({ queryKey: tournamentsKey });
      return options?.onSettled?.(...args);
    },
  });
}
