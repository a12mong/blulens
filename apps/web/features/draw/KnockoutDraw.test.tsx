import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KnockoutDraw } from './KnockoutDraw';
import { ApiRequestError } from '@/lib/api/client';
import { useStandings } from '@/features/bracket/api';
import { usePreviewKnockout, usePublishDraw, type Draw } from './knockoutApi';

vi.mock('@/features/bracket/api', () => ({
  useStandings: vi.fn(),
}));

vi.mock('./knockoutApi', () => ({
  usePreviewKnockout: vi.fn(),
  usePublishDraw: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('KnockoutDraw', () => {
  const originalEnv = process.env.NEXT_PUBLIC_KNOCKOUT_UI;

  let mockPreviewMutate: ReturnType<typeof vi.fn>;
  let mockPreviewReset: ReturnType<typeof vi.fn>;
  let mockPublishMutate: ReturnType<typeof vi.fn>;
  let mockPublishReset: ReturnType<typeof vi.fn>;
  let mockPreviewError: ApiRequestError | null = null;
  let mockPublishError: ApiRequestError | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_KNOCKOUT_UI = '1';

    mockPreviewMutate = vi.fn();
    mockPreviewReset = vi.fn();
    mockPublishMutate = vi.fn();
    mockPublishReset = vi.fn();
    mockPreviewError = null;
    mockPublishError = null;

    vi.mocked(useStandings).mockReturnValue({
      data: [
        {
          eventId: 'evt-1',
          groupLabel: 'A',
          rank: 1,
          entryId: 'en-1',
          confirmed: true,
          played: 2,
          won: 2,
          lost: 0,
          points: 4,
        },
        {
          eventId: 'evt-1',
          groupLabel: 'A',
          rank: 2,
          entryId: 'en-2',
          confirmed: true,
          played: 2,
          won: 1,
          lost: 1,
          points: 2,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useStandings>);

    vi.mocked(usePreviewKnockout).mockImplementation(() => ({
      mutate: mockPreviewMutate,
      isPending: false,
      error: mockPreviewError,
      reset: mockPreviewReset,
    } as unknown as ReturnType<typeof usePreviewKnockout>));

    vi.mocked(usePublishDraw).mockImplementation(() => ({
      mutate: mockPublishMutate,
      isPending: false,
      isSuccess: false,
      error: mockPublishError,
      reset: mockPublishReset,
    } as unknown as ReturnType<typeof usePublishDraw>));
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_KNOCKOUT_UI = originalEnv;
  });

  it('previews the knockout draw once the groups are locked and publishes it behind a confirm', async () => {
    let previewCallback: ((draw: Draw) => void) | undefined;
    let publishCallback: ((draw: Draw) => void) | undefined;

    mockPreviewMutate.mockImplementation((_payload, options) => {
      previewCallback = options?.onSuccess;
    });

    mockPublishMutate.mockImplementation((_payload, options) => {
      publishCallback = options?.onSuccess;
    });

    renderWithClient(<KnockoutDraw eventId="evt-1" />);

    // locked standings -> knockout-preview visible
    const previewBtn = screen.getByTestId('knockout-preview');
    expect(previewBtn).toBeInTheDocument();
    expect(previewBtn).toHaveTextContent('จัดสายน็อกเอาต์');

    // click -> mutate called
    fireEvent.click(previewBtn);
    expect(mockPreviewMutate).toHaveBeenCalledTimes(1);

    // summary shown
    const mockDraftDraw: Draw = {
      id: 'draw-ko-1',
      eventId: 'evt-1',
      kind: 'knockout',
      status: 'preview',
      size: 8,
      version: 1,
      createdAt: '2026-10-08T09:00:00.000Z',
    };
    act(() => {
      previewCallback?.(mockDraftDraw);
    });

    const summary = screen.getByTestId('knockout-preview-summary');
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent('ขนาดสาย: 8 ทีม (3 รอบ) · ฉบับที่ 1');

    // publish -> dialog -> publish mutate called with the draw id
    const publishBtn = screen.getByTestId('knockout-publish');
    expect(publishBtn).toHaveTextContent('เผยแพร่สายน็อกเอาต์');
    fireEvent.click(publishBtn);

    // dialog confirmation appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('เผยแพร่แล้วจะสร้างแมตช์น็อกเอาต์และเปลี่ยนไม่ได้'),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('knockout-publish-confirm');
    fireEvent.click(confirmBtn);

    expect(mockPublishMutate).toHaveBeenCalledWith(
      { drawId: 'draw-ko-1', eventId: 'evt-1' },
      expect.any(Object),
    );

    // simulate publish success
    const mockPublishedDraw: Draw = {
      ...mockDraftDraw,
      status: 'published',
    };
    act(() => {
      publishCallback?.(mockPublishedDraw);
    });

    expect(screen.getByTestId('knockout-published')).toBeInTheDocument();
    expect(screen.getByText('เผยแพร่สายน็อกเอาต์แล้ว')).toBeInTheDocument();
    const bracketLink = screen.getByRole('link', { name: 'ดูผังสายแข่ง' });
    expect(bracketLink).toHaveAttribute('href', '/events/evt-1/bracket');
  });

  it('displays Thai error text when preview returns 409 GROUP_STAGE_NOT_CONFIRMED', () => {
    mockPreviewError = new ApiRequestError(
      409,
      'GROUP_STAGE_NOT_CONFIRMED',
      'Group stage not confirmed',
    );

    vi.mocked(usePreviewKnockout).mockImplementation(() => ({
      mutate: mockPreviewMutate,
      isPending: false,
      error: mockPreviewError,
      reset: mockPreviewReset,
    } as unknown as ReturnType<typeof usePreviewKnockout>));

    renderWithClient(<KnockoutDraw eventId="evt-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ต้องยืนยันผลรอบกลุ่มก่อนจัดสายน็อกเอาต์',
    );
  });

  it('displays Thai error text when publish returns 409 DRAW_KIND_NOT_SUPPORTED', () => {
    let previewCallback: ((draw: Draw) => void) | undefined;
    mockPreviewMutate.mockImplementation((_payload, options) => {
      previewCallback = options?.onSuccess;
    });

    mockPublishError = new ApiRequestError(
      409,
      'DRAW_KIND_NOT_SUPPORTED',
      'Draw kind not supported',
    );

    vi.mocked(usePublishDraw).mockImplementation(() => ({
      mutate: mockPublishMutate,
      isPending: false,
      isSuccess: false,
      error: mockPublishError,
      reset: mockPublishReset,
    } as unknown as ReturnType<typeof usePublishDraw>));

    renderWithClient(<KnockoutDraw eventId="evt-1" />);
    fireEvent.click(screen.getByTestId('knockout-preview'));

    act(() => {
      previewCallback?.({
        id: 'draw-ko-1',
        eventId: 'evt-1',
        kind: 'knockout',
        status: 'preview',
        size: 4,
        version: 1,
        createdAt: '2026-10-08T09:00:00.000Z',
      });
    });

    fireEvent.click(screen.getByTestId('knockout-publish'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('ยังไม่รองรับรูปแบบนี้');
  });

  it('renders nothing when group stage is not locked', () => {
    vi.mocked(useStandings).mockReturnValue({
      data: [
        {
          eventId: 'evt-1',
          groupLabel: 'A',
          rank: 1,
          entryId: 'en-1',
          confirmed: false,
          played: 1,
          won: 1,
          lost: 0,
          points: 2,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useStandings>);

    const { container } = renderWithClient(<KnockoutDraw eventId="evt-1" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('knockout-preview')).toBeNull();
  });

  it('renders nothing when standings are empty', () => {
    vi.mocked(useStandings).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useStandings>);

    const { container } = renderWithClient(<KnockoutDraw eventId="evt-1" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('knockout-preview')).toBeNull();
  });

  it('renders nothing when NEXT_PUBLIC_KNOCKOUT_UI is 0', () => {
    process.env.NEXT_PUBLIC_KNOCKOUT_UI = '0';
    const { container } = renderWithClient(<KnockoutDraw eventId="evt-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('supports re-roll with ReasonDialog (minimum 5 chars)', () => {
    let previewCallback: ((draw: Draw) => void) | undefined;
    mockPreviewMutate.mockImplementation((_payload, options) => {
      previewCallback = options?.onSuccess;
    });

    renderWithClient(<KnockoutDraw eventId="evt-1" />);
    fireEvent.click(screen.getByTestId('knockout-preview'));

    act(() => {
      previewCallback?.({
        id: 'draw-ko-1',
        eventId: 'evt-1',
        kind: 'knockout',
        status: 'preview',
        size: 8,
        version: 1,
        createdAt: '2026-10-08T09:00:00.000Z',
      });
    });

    fireEvent.click(screen.getByTestId('knockout-reroll'));

    const textarea = screen.getByTestId('reason-input');
    expect(textarea).toBeInTheDocument();

    const submitBtn = screen.getByTestId('reason-submit');
    expect(submitBtn).toBeDisabled();

    // Less than 5 chars
    fireEvent.change(textarea, { target: { value: '1234' } });
    expect(submitBtn).toBeDisabled();

    // 5 chars or more
    fireEvent.change(textarea, { target: { value: 'ต้องการสุ่มสายใหม่' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    expect(mockPreviewMutate).toHaveBeenCalledTimes(2);
    expect(mockPreviewMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        seed: expect.any(String),
        reason: 'ต้องการสุ่มสายใหม่',
      }),
      expect.any(Object),
    );
  });

  it('renders preview pairings and conflicts when present', () => {
    let previewCallback: ((draw: Draw) => void) | undefined;
    mockPreviewMutate.mockImplementation((_payload, options) => {
      previewCallback = options?.onSuccess;
    });

    renderWithClient(<KnockoutDraw eventId="evt-1" />);
    fireEvent.click(screen.getByTestId('knockout-preview'));

    act(() => {
      previewCallback?.({
        id: 'draw-ko-1',
        eventId: 'evt-1',
        kind: 'knockout',
        status: 'preview',
        size: 4,
        version: 1,
        createdAt: '2026-10-08T09:00:00.000Z',
        slots: [
          {
            position: 1,
            entryId: 'en-1',
            entry: { entryId: 'en-1', displayName: 'สมชาย / วิภา' },
            source: { groupLabel: 'A', place: 1 },
          },
          {
            position: 2,
            entryId: 'en-2',
            entry: { entryId: 'en-2', displayName: 'อนันต์ / มาลี' },
            source: { groupLabel: 'B', place: 2 },
          },
        ],
        conflicts: [
          {
            matchNo: 1,
            kind: 'group',
            groupLabel: 'A',
          },
        ],
      });
    });

    expect(screen.getByTestId('knockout-preview-conflicts')).toHaveTextContent(
      'พบทีมหรือกลุ่มที่ชนกันในรอบแรก',
    );
    expect(screen.getByTestId('knockout-preview-pairings')).toBeInTheDocument();
    expect(screen.getByText('สมชาย / วิภา')).toBeInTheDocument();
    expect(screen.getByText('แชมป์กลุ่ม A')).toBeInTheDocument();
    expect(screen.getByText('อนันต์ / มาลี')).toBeInTheDocument();
  });
});
