import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Mock the api module before importing CreateTournamentForm
vi.mock('@/features/events/api', () => ({
  useCreateTournament: vi.fn(),
  useCreateEvent: vi.fn(),
  useEventEntries: vi.fn(),
}));

import { CreateTournamentForm } from './CreateTournamentForm';

const mockUseCreateTournament = vi.fn();

describe('CreateTournamentForm', () => {
  it('submits TournamentInput with ISO close time', async () => {
    const mockMutate = vi.fn();
    mockUseCreateTournament.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
      status: 'idle',
      reset: vi.fn(),
      failureReason: null,
      failureCount: 0,
      isIdle: true,
      isPaused: false,
      variables: undefined,
    } as any);

    render(<CreateTournamentForm />);

    const nameInput = screen.getByTestId('tournament-name');
    const startsOnInput = screen.getByTestId('tournament-starts-on');
    const closeInput = screen.getByTestId('tournament-entries-close');
    const submitButton = screen.getByTestId('tournament-submit');

    await userEvent.type(nameInput, 'Cup');
    fireEvent.change(startsOnInput, { target: { value: '2026-11-01' } });
    fireEvent.change(closeInput, { target: { value: '2026-10-25T10:00' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        name: 'Cup',
        startsOn: '2026-11-01',
        entriesCloseAt: new Date('2026-10-25T10:00').toISOString(),
      });
    });
  });

  it('close after start blocks submit with error message', async () => {
    const mockMutate = vi.fn();
    mockUseCreateTournament.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
      status: 'idle',
      reset: vi.fn(),
    } as any);

    const { container } = render(<CreateTournamentForm />);

    // Get form elements
    const startsOnInput = container.querySelector('input[name="startsOn"]') as HTMLInputElement;
    const closeInput = container.querySelector('input[name="entriesCloseAt"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    // Set values: close date after start date
    fireEvent.change(startsOnInput, { target: { value: '2026-10-25' } });
    fireEvent.change(closeInput, { target: { value: '2026-10-26T10:00' } });

    // Submit form
    fireEvent.submit(form);

    // Error should be shown and mutate not called
    await waitFor(() => {
      const error = container.querySelector('[data-testid="tournament-error"]');
      expect(error?.textContent).toContain('ปิดรับสมัครต้องก่อนวันแข่ง');
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
