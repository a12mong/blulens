import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api/client';
import { useReportResult, useUmpireMatches, type Match } from './api';
import { DEFAULT_FORMATS, UmpireMatchPage } from './UmpireMatchPage';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/umpire/matches/m-knockout',
}));

vi.mock('./api', () => ({
  useUmpireMatches: vi.fn(),
  useReportResult: vi.fn(),
}));

describe('UmpireMatchPage', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (useReportResult as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });
  });

  const mockMatches: Match[] = [
    {
      id: 'm-knockout',
      stage: 'knockout',
      round: 1,
      court: '1',
      status: 'scheduled',
      aEntry: {
        entryId: 'e-1',
        displayName: 'คู่ ก / ข',
        teamNames: ['สโมสร ก'],
      },
      bEntry: {
        entryId: 'e-2',
        displayName: 'คู่ ค / ง',
        teamNames: ['สโมสร ข'],
      },
    },
    {
      id: 'm-group',
      stage: 'group',
      round: 1,
      court: '2',
      status: 'scheduled',
      aEntry: {
        entryId: 'e-3',
        displayName: 'คู่ จ / ฉ',
      },
      bEntry: {
        entryId: 'e-4',
        displayName: 'คู่ ช / ซ',
      },
    },
  ];

  it('renders MatchResultForm for a found match with stage knockout format', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockMatches,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<UmpireMatchPage id="m-knockout" />);

    // MatchResultForm rendered
    expect(screen.getByText('คู่ ก / ข')).toBeInTheDocument();
    expect(screen.getByText('คู่ ค / ง')).toBeInTheDocument();
    expect(screen.getByTestId('result-submit')).toBeInTheDocument();

    // Verify format badge shows 2 ใน 3 เกม × 21 แต้ม (knockout bo3_21)
    const badge = screen.getByTestId('match-format-badge');
    expect(badge).toHaveTextContent('2 ใน 3 เกม');
    expect(badge).toHaveTextContent('21 แต้ม');
  });

  it('renders MatchResultForm for a found match with stage group format', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockMatches,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<UmpireMatchPage id="m-group" />);

    expect(screen.getByText('คู่ จ / ฉ')).toBeInTheDocument();
    expect(screen.getByText('คู่ ช / ซ')).toBeInTheDocument();

    // Verify format badge shows 2 เกม × 15 แต้ม เสมอได้ (group 2x15)
    const badge = screen.getByTestId('match-format-badge');
    expect(badge).toHaveTextContent('2 เกม');
    expect(badge).toHaveTextContent('15 แต้ม');
    expect(badge).toHaveTextContent('เสมอได้');
  });

  it('renders missing text when match id is not found', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockMatches,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<UmpireMatchPage id="m-unknown" />);

    const missing = screen.getByTestId('umpire-match-missing');
    expect(missing).toBeInTheDocument();
    expect(missing).toHaveTextContent('ไม่พบแมตช์นี้ หรือคุณไม่มีสิทธิ์');
    expect(screen.queryByTestId('result-submit')).not.toBeInTheDocument();
  });

  it('renders skeleton loading state', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<UmpireMatchPage id="m-knockout" />);

    expect(screen.getByTestId('umpire-match-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state on query error', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiRequestError(403, 'FORBIDDEN', 'Forbidden'),
    });

    render(<UmpireMatchPage id="m-knockout" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'umpire-match-error');
    expect(alert).toHaveTextContent('คุณไม่มีสิทธิ์ทำรายการนี้');
  });

  it('exports valid DEFAULT_FORMATS', () => {
    expect(DEFAULT_FORMATS.group).toEqual({
      preset: 'group_2x15',
      mode: 'fixed_games',
      games: 2,
      pointsPerGame: 15,
      deuce: false,
      cap: null,
      drawAllowed: true,
    });

    expect(DEFAULT_FORMATS.knockout).toEqual({
      preset: 'bo3_21',
      mode: 'best_of',
      games: 3,
      pointsPerGame: 21,
      deuce: true,
      cap: 30,
      drawAllowed: false,
    });

    expect(DEFAULT_FORMATS.third_place).toEqual({
      preset: 'bo3_21',
      mode: 'best_of',
      games: 3,
      pointsPerGame: 21,
      deuce: true,
      cap: 30,
      drawAllowed: false,
    });
  });
});
