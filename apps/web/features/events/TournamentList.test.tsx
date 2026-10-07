import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMe } from '@/features/auth/api';
import { TournamentList } from './TournamentList';
import { useEvents, useSetTournamentStatus, useTournaments } from './api';

vi.mock('@/features/auth/api', () => ({
  useMe: vi.fn(),
}));

vi.mock('./api', () => ({
  useTournaments: vi.fn(),
  useEvents: vi.fn(),
  useSetTournamentStatus: vi.fn(),
}));

describe('TournamentList', () => {
  const mockTournaments = [
    {
      id: 't-1',
      name: 'ทัวร์นาเมนต์ 1',
      startsOn: '2026-11-12',
      entriesCloseAt: '2026-11-01T23:59:59Z',
      status: 'draft' as const,
      venue: 'สนาม A',
    },
    {
      id: 't-2',
      name: 'ทัวร์นาเมนต์ 2',
      startsOn: '2026-12-01',
      entriesCloseAt: '2026-11-20T23:59:59Z',
      status: 'open' as const,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEvents).mockReturnValue({
      data: [],
    } as any);
    vi.mocked(useSetTournamentStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('renders one card per tournament and shows the create link only for Committee', () => {
    vi.mocked(useTournaments).mockReturnValue({
      data: { items: mockTournaments },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // 1. Committee user: sees cards and create link
    vi.mocked(useMe).mockReturnValue({
      data: { id: 'u-1', displayName: 'กรรมการ A', roles: ['Committee', 'Member'] },
    } as any);

    const { rerender } = render(<TournamentList />);

    const cards = screen.getAllByTestId('tournament-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByTestId('tournament-create-open')).toHaveAttribute(
      'href',
      '/events/new',
    );

    // 2. Admin-only user: sees cards but NO create link
    vi.mocked(useMe).mockReturnValue({
      data: { id: 'u-2', displayName: 'แอดมิน B', roles: ['Admin'] },
    } as any);

    rerender(<TournamentList />);

    expect(screen.getAllByTestId('tournament-card')).toHaveLength(2);
    expect(screen.queryByTestId('tournament-create-open')).toBeNull();
  });

  it('shows 3 skeleton blocks while pending/loading', () => {
    vi.mocked(useMe).mockReturnValue({ data: null } as any);
    vi.mocked(useTournaments).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<TournamentList />);

    const skeletons = screen.getAllByTestId('tournament-skeleton');
    expect(skeletons).toHaveLength(3);
    expect(screen.queryByTestId('tournament-card')).toBeNull();
  });

  it('shows empty state when no tournaments exist', () => {
    vi.mocked(useMe).mockReturnValue({ data: null } as any);
    vi.mocked(useTournaments).mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<TournamentList />);

    const empty = screen.getByTestId('tournament-empty');
    expect(empty).toHaveTextContent('ยังไม่มีทัวร์นาเมนต์');
    expect(screen.queryByTestId('tournament-card')).toBeNull();
  });

  it('shows error banner with retry button that calls refetch on error', () => {
    const refetch = vi.fn();
    vi.mocked(useMe).mockReturnValue({ data: null } as any);
    vi.mocked(useTournaments).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว'),
      refetch,
    } as any);

    render(<TournamentList />);

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveAttribute('data-testid', 'tournament-list-error');
    expect(errorAlert).toHaveTextContent('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว');

    const retryBtn = screen.getByTestId('tournament-retry');
    expect(retryBtn).toHaveTextContent('ลองใหม่');
    fireEvent.click(retryBtn);

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('publish click calls the status mutation with {to:"open"} and a failing mutation shows tournament-publish-error', async () => {
    let mutateOptions: any = null;
    const mutate = vi.fn().mockImplementation((_body: any, options: any) => {
      mutateOptions = options;
    });

    vi.mocked(useSetTournamentStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as any);

    vi.mocked(useMe).mockReturnValue({
      data: { id: 'u-1', displayName: 'กรรมการ', roles: ['Committee'] },
    } as any);

    vi.mocked(useTournaments).mockReturnValue({
      data: { items: [mockTournaments[0]] }, // draft tournament
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<TournamentList />);

    const publishBtn = screen.getByTestId('tournament-publish');
    fireEvent.click(publishBtn);

    expect(mutate).toHaveBeenCalledWith(
      { to: 'open' },
      expect.any(Object),
    );

    // Simulate mutation error callback with server message inside act
    act(() => {
      mutateOptions?.onError(new Error('409 TOURNAMENT_INVALID_TRANSITION'));
    });

    const errorAlert = await screen.findByTestId('tournament-publish-error');
    expect(errorAlert).toHaveAttribute('role', 'alert');
    expect(errorAlert).toHaveTextContent('409 TOURNAMENT_INVALID_TRANSITION');
  });
});
