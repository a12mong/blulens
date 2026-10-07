import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import { createTournamentWithEvents, PartialCreateError } from './wizardApi';

vi.mock('@/lib/api/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/client')>()),
  apiFetch: vi.fn(),
}));

const input = {
  tournament: { name: 'Cup', startsOn: '2026-11-01', entriesCloseAt: '2026-10-25T00:00:00.000Z' },
  events: [{ discipline: 'XD' as const, gradeMin: 'S-' as const, gradeMax: 'S+' as const, formatPreset: 'knockout' as const }],
};

describe('createTournamentWithEvents', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('posts the tournament, then the event without formatPreset, then PUTs the format', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ id: 'T1' })
      .mockResolvedValueOnce({ id: 'E1' })
      .mockResolvedValueOnce({});
    const r = await createTournamentWithEvents(input);
    expect(r.tournament).toEqual({ id: 'T1' });
    const calls = vi.mocked(apiFetch).mock.calls;
    expect(calls[0][0]).toBe('/tournaments');
    expect(calls[1][0]).toBe('/tournaments/T1/events');
    expect(calls[1][1]?.body).toEqual({ discipline: 'XD', gradeMin: 'S-', gradeMax: 'S+' });
    expect(calls[2][0]).toBe('/events/E1/format');
    expect(calls[2][1]?.method).toBe('PUT');
    expect((calls[2][1]?.body as { type: string }).type).toBe('knockout');
  });

  it('reports a partial failure with the created draft tournament', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ id: 'T1' })
      .mockRejectedValueOnce(new ApiRequestError(409, 'EVENT_DUPLICATE', 'อีเวนต์ซ้ำ'));
    await expect(createTournamentWithEvents(input)).rejects.toBeInstanceOf(PartialCreateError);
  });
});
