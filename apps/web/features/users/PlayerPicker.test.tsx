import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api/client';
import { PlayerPicker, type PlayerValue } from './PlayerPicker';

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

describe('PlayerPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('typing then picking an option calls onChange with the player; typing alone clears it', async () => {
    const onChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [{ id: 'u1', displayName: 'สมชาย', roles: ['Member'], teamId: null }],
      nextCursor: null,
    });

    const { rerender } = render(<PlayerPicker value={null} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');

    // Type 'สม'
    fireEvent.change(input, { target: { value: 'สม' } });
    expect(onChange).toHaveBeenCalledWith(null);

    // Advance 250ms for debounce timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // Option should be rendered
    const option = await waitFor(() => screen.getByTestId('player-option'));
    expect(option).toHaveTextContent('สมชาย');

    // Click option
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith({ userId: 'u1', displayName: 'สมชาย' });
    expect(input).toHaveValue('สมชาย');

    // Re-render with new value from parent
    rerender(
      <PlayerPicker
        value={{ userId: 'u1', displayName: 'สมชาย' }}
        onChange={onChange}
      />,
    );

    // Type 'x' -> should clear value (call onChange(null))
    fireEvent.change(input, { target: { value: 'สมชายx' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('calls apiFetch with /users and query { role: "Member", q: "สม", limit: 8 }', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [{ id: 'u1', displayName: 'สมชาย' }],
    });

    render(<PlayerPicker value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'สม' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/users', {
        query: { role: 'Member', q: 'สม', limit: 8 },
      });
    });
  });

  it('shows player-empty message when no match', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    render(<PlayerPicker value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'ไม่มี' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const empty = await waitFor(() => screen.getByTestId('player-empty'));
    expect(empty).toHaveTextContent('ไม่พบผู้เล่น');
  });

  it('picks option via keyboard ArrowDown + Enter', async () => {
    const onChange = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [
        { id: 'u1', displayName: 'Player 1' },
        { id: 'u2', displayName: 'Player 2' },
      ],
    });

    render(<PlayerPicker value={null} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'player' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('player-option')).toHaveLength(2);
    });

    const options = screen.getAllByTestId('player-option');

    // ArrowDown to first option (Player 1)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // ArrowDown to second option (Player 2)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    // Press Enter to pick Player 2
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ userId: 'u2', displayName: 'Player 2' });
    expect(input).toHaveValue('Player 2');
  });

  it('closes dropdown on Escape key', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [{ id: 'u1', displayName: 'Player 1' }],
    });

    render(<PlayerPicker value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'play' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-options')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('player-options')).not.toBeInTheDocument();
  });
});
