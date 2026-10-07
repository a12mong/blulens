import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api/client';
import { TeamCombobox } from './TeamCombobox';

vi.mock('@/lib/api/client');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('TeamCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('typing then picking an option calls onChange with the team; typing alone clears it', async () => {
    const onChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { teamId: 't1', name: 'Blue Wing', matchedAlias: null, distance: 0 },
    ]);

    const { rerender } = render(<TeamCombobox value={null} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('team-input');

    // Type 'blu'
    fireEvent.change(input, { target: { value: 'blu' } });
    expect(onChange).toHaveBeenCalledWith(null);

    // Advance 250ms for debounce timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // Wait for option to appear
    const option = await waitFor(() => screen.getByTestId('team-option'));
    expect(option).toHaveTextContent('Blue Wing');

    // Click option
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith({ teamId: 't1', name: 'Blue Wing' });
    expect(input).toHaveValue('Blue Wing');

    // Re-render with new value from parent
    rerender(
      <TeamCombobox
        value={{ teamId: 't1', name: 'Blue Wing' }}
        onChange={onChange}
      />,
    );

    // Type 'x' -> should clear value (call onChange(null))
    fireEvent.change(input, { target: { value: 'Blue Wingx' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('renders matchedAlias text when matchedAlias is present', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { teamId: 't2', name: 'Thunderbirds', matchedAlias: 'Old Birds', distance: 1 },
    ]);

    render(<TeamCombobox value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('team-input');
    fireEvent.change(input, { target: { value: 'thu' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const option = await waitFor(() => screen.getByTestId('team-option'));
    expect(option).toHaveTextContent('Thunderbirds');
    expect(option).toHaveTextContent('(ชื่อเดิม: Old Birds)');
  });

  it('shows request-new button when no match, and clicking posts { name }', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([]) // suggestions empty
      .mockResolvedValueOnce({ id: 'req-1', name: 'New Team', status: 'pending' }); // team-requests post

    render(<TeamCombobox value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('team-input');
    fireEvent.change(input, { target: { value: 'New Team' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const requestButton = await waitFor(() => screen.getByTestId('team-request-new'));
    expect(requestButton).toHaveTextContent('ขอเพิ่มทีม "New Team"');

    // Click request new team button
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/team-requests', {
        method: 'POST',
        body: { name: 'New Team' },
      });
    });

    const sentMessage = await waitFor(() => screen.getByTestId('team-request-sent'));
    expect(sentMessage).toHaveTextContent('ส่งคำขอแล้ว รอคณะกรรมการอนุมัติ');
  });

  it('picks option via keyboard ArrowDown + Enter', async () => {
    const onChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { teamId: 't1', name: 'Alpha' },
      { teamId: 't2', name: 'Beta' },
    ]);

    render(<TeamCombobox value={null} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('team-input');
    fireEvent.change(input, { target: { value: 'team' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('team-option')).toHaveLength(2);
    });

    const options = screen.getAllByTestId('team-option');

    // ArrowDown to first option (Alpha)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // ArrowDown to second option (Beta)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    // Press Enter to pick Beta
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ teamId: 't2', name: 'Beta' });
    expect(input).toHaveValue('Beta');
  });

  it('closes dropdown on Escape key', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([{ teamId: 't1', name: 'Alpha' }]);

    render(<TeamCombobox value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('team-input');
    fireEvent.change(input, { target: { value: 'al' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(screen.getByTestId('team-options')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('team-options')).not.toBeInTheDocument();
  });
});
