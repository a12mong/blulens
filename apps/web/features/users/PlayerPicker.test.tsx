import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api/client';
import { PlayerPicker } from './PlayerPicker';

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

  it('does not offer the player already chosen elsewhere', async () => {
    const playerA = { id: 'u-a', displayName: 'สมชาย', roles: ['Member'] };
    const playerB = { id: 'u-b', displayName: 'วิภา', roles: ['Member'] };

    vi.mocked(apiFetch).mockResolvedValue({
      items: [playerA, playerB],
    });

    // 1. With excludeUserIds=[playerA.id] -> only playerB is listed
    const { rerender } = render(
      <PlayerPicker
        value={null}
        onChange={vi.fn()}
        excludeUserIds={[playerA.id]}
      />,
      { wrapper: createWrapper() },
    );

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'สม' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      const options = screen.getAllByTestId('player-option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('วิภา');
      expect(screen.queryByText('สมชาย')).toBeNull();
    });

    // 2. With no exclusion -> both are listed
    rerender(
      <PlayerPicker
        value={null}
        onChange={vi.fn()}
        excludeUserIds={[]}
      />,
    );

    await waitFor(() => {
      const options = screen.getAllByTestId('player-option');
      expect(options).toHaveLength(2);
      expect(screen.getByText('สมชาย')).toBeInTheDocument();
      expect(screen.getByText('วิภา')).toBeInTheDocument();
    });
  });

  it('shows option meta with club names and grade label, or default placeholders', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [
        {
          id: 'u-1',
          displayName: 'อนันต์',
          teamNames: ['A', 'B'],
          gradeLabel: 'S+',
        },
        {
          id: 'u-2',
          displayName: 'มาลี',
          teamNames: [],
          gradeLabel: null,
        },
        {
          id: 'u-3',
          displayName: 'ชูชีพ',
          teamNames: ['ClubX'],
          gradeLabel: 'A',
          gradeProvisional: true,
        },
      ],
    });

    render(<PlayerPicker value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'test' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('player-option')).toHaveLength(3);
    });

    const metas = screen.getAllByTestId('player-option-meta');
    expect(metas).toHaveLength(3);

    // Option 1: teamNames ['A', 'B'] and gradeLabel 'S+'
    expect(metas[0]).toHaveTextContent('A, B');
    expect(metas[0]).toHaveTextContent('S+');
    expect(metas[0]).toHaveTextContent('A, B · S+');

    // Option 2: empty teamNames -> 'ไม่มีสโมสร', null gradeLabel -> 'ยังไม่มีเกรด'
    expect(metas[1]).toHaveTextContent('ไม่มีสโมสร · ยังไม่มีเกรด');

    // Option 3: provisional grade -> appends ' (ชั่วคราว)'
    expect(metas[2]).toHaveTextContent('ClubX · A (ชั่วคราว)');
  });

  it('defensively handles undefined teamNames and gradeLabel', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [
        {
          id: 'u-1',
          displayName: 'ผู้เล่นไร้ฟิลด์',
          // teamNames and gradeLabel both undefined (e.g. unmigrated backend)
        },
        {
          id: 'u-2',
          displayName: 'มีแต่สโมสร',
          teamNames: ['Club Alpha'],
          gradeLabel: undefined,
        },
        {
          id: 'u-3',
          displayName: 'มีแต่เกรดเป็น null',
          teamNames: undefined,
          gradeLabel: null,
        },
        {
          id: 'u-4',
          displayName: 'สโมสรว่างเกรดไม่มี',
          teamNames: [],
          gradeLabel: undefined,
        },
      ],
    });

    render(<PlayerPicker value={null} onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'ผู้เล่น' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('player-option')).toHaveLength(4);
    });

    const options = screen.getAllByTestId('player-option');

    // Option 1: both undefined -> whole meta line omitted!
    expect(options[0].querySelector('[data-testid="player-option-meta"]')).toBeNull();

    // Option 2: only teamNames present -> only club name shown, no grade
    const meta1 = options[1].querySelector('[data-testid="player-option-meta"]');
    expect(meta1).not.toBeNull();
    expect(meta1).toHaveTextContent('Club Alpha');
    expect(meta1?.textContent).not.toContain('·');

    // Option 3: only gradeLabel null -> only 'ยังไม่มีเกรด' shown, no club
    const meta2 = options[2].querySelector('[data-testid="player-option-meta"]');
    expect(meta2).not.toBeNull();
    expect(meta2).toHaveTextContent('ยังไม่มีเกรด');
    expect(meta2?.textContent).not.toContain('·');

    // Option 4: teamNames empty array -> 'ไม่มีสโมสร', gradeLabel undefined -> no grade
    const meta3 = options[3].querySelector('[data-testid="player-option-meta"]');
    expect(meta3).not.toBeNull();
    expect(meta3).toHaveTextContent('ไม่มีสโมสร');
    expect(meta3?.textContent).not.toContain('·');
  });

  it('shows ผู้เล่นคนนี้ถูกเลือกไปแล้ว when all returned results are excluded', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      items: [{ id: 'u-x', displayName: 'สมชาย', roles: ['Member'] }],
    });

    render(
      <PlayerPicker
        value={null}
        onChange={vi.fn()}
        excludeUserIds={['u-x']}
      />,
      { wrapper: createWrapper() },
    );

    const input = screen.getByTestId('player-input');
    fireEvent.change(input, { target: { value: 'สมชาย' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const emptyEl = await waitFor(() => screen.getByTestId('player-empty'));
    expect(emptyEl).toHaveTextContent('ผู้เล่นคนนี้ถูกเลือกไปแล้ว');
  });
});
