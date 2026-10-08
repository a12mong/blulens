import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GroupDraw } from './GroupDraw';
import * as drawApi from './api';

vi.mock('./api', () => ({
  useGroups: vi.fn(),
  usePreviewGroups: vi.fn(),
  usePublishDraw: vi.fn(),
}));

describe('GroupDraw', () => {
  const mockPreviewMutate = vi.fn();
  const mockPublishMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(drawApi.useGroups).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof drawApi.useGroups>);

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((eventId, options) => ({
      mutate: (payload?: any) => {
        mockPreviewMutate(payload);
      },
      isPending: false,
    } as unknown as ReturnType<typeof drawApi.usePreviewGroups>));

    vi.mocked(drawApi.usePublishDraw).mockImplementation((options) => ({
      mutate: (payload: any) => {
        mockPublishMutate(payload);
      },
      isPending: false,
    } as unknown as ReturnType<typeof drawApi.usePublishDraw>));
  });

  it('previews, requires acknowledgement when there are conflicts, then publishes', async () => {
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;
    let capturedPublishSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as any;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((options) => {
      capturedPublishSuccess = options?.onSuccess as any;
      return {
        mutate: mockPublishMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePublishDraw>;
    });

    render(<GroupDraw eventId="e1" />);

    // Initial state: draw-preview button exists
    const previewBtn = screen.getByTestId('draw-preview');
    expect(previewBtn).toHaveTextContent('จับกลุ่ม');
    fireEvent.click(previewBtn);
    expect(mockPreviewMutate).toHaveBeenCalledTimes(1);

    // Simulate preview returning a conflict
    const conflictDraw: drawApi.Draw = {
      id: 'd1',
      eventId: 'e1',
      version: 1,
      status: 'preview',
      kind: 'group',
      size: 8,
      sameTeamR1Count: 1,
      createdAt: '2026-10-08T00:00:00Z',
      conflicts: [{ matchNo: 1, teamId: 'BC BKK' } as any],
    };
    act(() => {
      capturedPreviewSuccess?.(conflictDraw);
    });

    // Draw summary rendered
    await waitFor(() => {
      expect(screen.getByTestId('draw-summary')).toHaveTextContent('ขนาด 8 · ทีมเดียวกันชนรอบแรก 1');
    });

    // Conflicts box visible
    expect(screen.getByTestId('draw-conflicts')).toBeInTheDocument();

    // Publish button is disabled before acknowledgement
    const publishBtn = screen.getByTestId('draw-publish');
    expect(publishBtn).toBeDisabled();

    // Tick acknowledgement checkbox
    const ackCheckbox = screen.getByTestId('draw-ack-conflicts');
    fireEvent.click(ackCheckbox);
    expect(publishBtn).toBeDisabled(); // Still disabled without 5-char reason

    // Enter short reason (less than 5 chars)
    const reasonInput = screen.getByTestId('draw-conflict-reason');
    fireEvent.change(reasonInput, { target: { value: 'ABCD' } });
    expect(publishBtn).toBeDisabled();

    // Enter valid reason (>= 5 chars)
    fireEvent.change(reasonInput, { target: { value: 'ยอมรับทีมชนกัน' } });
    expect(publishBtn).toBeEnabled();

    // Click publish -> opens confirm dialog
    fireEvent.click(publishBtn);
    expect(screen.getByText('เผยแพร่แล้วจะสร้างแมตช์และจับกลุ่มใหม่ไม่ได้')).toBeInTheDocument();

    // Confirm publish
    const confirmBtn = screen.getByTestId('confirm-publish');
    fireEvent.click(confirmBtn);

    expect(mockPublishMutate).toHaveBeenCalledWith({
      drawId: 'd1',
      eventId: 'e1',
      acknowledgeConflicts: true,
      reason: 'ยอมรับทีมชนกัน',
    });
  });

  it('no conflicts enables publish immediately without requiring ack', async () => {
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;
    let capturedPublishSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as any;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((options) => {
      capturedPublishSuccess = options?.onSuccess as any;
      return {
        mutate: mockPublishMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePublishDraw>;
    });

    render(<GroupDraw eventId="e1" />);
    fireEvent.click(screen.getByTestId('draw-preview'));

    // Preview with 0 conflicts
    act(() => {
      capturedPreviewSuccess?.({
        id: 'd2',
        eventId: 'e1',
        version: 1,
        status: 'preview',
        kind: 'group',
        size: 4,
        sameTeamR1Count: 0,
        createdAt: '2026-10-08T00:00:00Z',
        conflicts: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('draw-summary')).toBeInTheDocument();
    });

    // Conflicts box not rendered
    expect(screen.queryByTestId('draw-conflicts')).toBeNull();

    // Publish button is enabled immediately
    const publishBtn = screen.getByTestId('draw-publish');
    expect(publishBtn).toBeEnabled();

    fireEvent.click(publishBtn);
    const confirmBtn = screen.getByTestId('confirm-publish');
    fireEvent.click(confirmBtn);

    expect(mockPublishMutate).toHaveBeenCalledWith({
      drawId: 'd2',
      eventId: 'e1',
      acknowledgeConflicts: undefined,
      reason: undefined,
    });
  });

  it('published state hides action buttons and displays links', async () => {
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;
    let capturedPublishSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as any;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((options) => {
      capturedPublishSuccess = options?.onSuccess as any;
      return {
        mutate: mockPublishMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePublishDraw>;
    });

    render(<GroupDraw eventId="e1" />);
    fireEvent.click(screen.getByTestId('draw-preview'));

    act(() => {
      capturedPreviewSuccess?.({
        id: 'd3',
        eventId: 'e1',
        version: 1,
        status: 'preview',
        kind: 'group',
        size: 4,
        sameTeamR1Count: 0,
        createdAt: '2026-10-08T00:00:00Z',
        conflicts: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('draw-publish')).toBeInTheDocument();
    });

    // Simulate successful publish
    act(() => {
      capturedPublishSuccess?.({
        id: 'd3',
        eventId: 'e1',
        version: 1,
        status: 'published',
        kind: 'group',
        size: 4,
        sameTeamR1Count: 0,
        createdAt: '2026-10-08T00:00:00Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('draw-published')).toHaveTextContent('เผยแพร่แล้ว');
    });

    // Buttons are gone
    expect(screen.queryByTestId('draw-preview')).toBeNull();
    expect(screen.queryByTestId('draw-reroll')).toBeNull();
    expect(screen.queryByTestId('draw-publish')).toBeNull();

    // Links present
    const standingsLink = screen.getByRole('link', { name: 'ตารางคะแนน' });
    expect(standingsLink).toHaveAttribute('href', '/events/e1/standings');

    const resultsLink = screen.getByRole('link', { name: 'ผลที่รอยืนยัน' });
    expect(resultsLink).toHaveAttribute('href', '/committee/events/e1/results');
  });

  it('renders Thai error message when preview fails', async () => {
    let capturedPreviewError: ((err: any) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((eventId, options) => {
      capturedPreviewError = options?.onError as any;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    render(<GroupDraw eventId="e1" />);
    fireEvent.click(screen.getByTestId('draw-preview'));

    const { ApiRequestError } = await import('@/lib/api/client');
    act(() => {
      capturedPreviewError?.(new ApiRequestError(409, 'DRAW_ALREADY_LOCKED', 'Draw already locked'));
    });

    await waitFor(() => {
      const errorEl = screen.getByTestId('draw-error');
      expect(errorEl).toHaveTextContent('จับกลุ่มล็อกแล้ว');
    });
  });

  it('rerolls draw via ReasonDialog requiring 5 characters', async () => {
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as any;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    render(<GroupDraw eventId="e1" />);
    fireEvent.click(screen.getByTestId('draw-preview'));

    act(() => {
      capturedPreviewSuccess?.({
        id: 'd4',
        eventId: 'e1',
        version: 1,
        status: 'preview',
        kind: 'group',
        size: 4,
        sameTeamR1Count: 0,
        createdAt: '2026-10-08T00:00:00Z',
        conflicts: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('draw-reroll')).toBeInTheDocument();
    });

    // Click reroll button
    fireEvent.click(screen.getByTestId('draw-reroll'));

    // Reason dialog appears
    const reasonSubmit = screen.getByTestId('reason-submit');
    expect(reasonSubmit).toBeDisabled();

    const reasonInput = screen.getByTestId('reason-input');
    fireEvent.change(reasonInput, { target: { value: 'ขอสุ่มใหม่' } });
    expect(reasonSubmit).toBeEnabled();

    fireEvent.click(reasonSubmit);
    expect(mockPreviewMutate).toHaveBeenCalledWith({ reason: 'ขอสุ่มใหม่' });
  });
});
