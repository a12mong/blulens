import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GroupDraw } from './GroupDraw';
import * as drawApi from './api';
import * as eventsApi from '@/features/events/api';
import * as entriesApi from '@/features/entries/api';

vi.mock('./api', () => ({
  useGroups: vi.fn(),
  usePreviewGroups: vi.fn(),
  usePublishDraw: vi.fn(),
}));

vi.mock('@/features/events/api', () => ({
  useEvent: vi.fn(),
}));

vi.mock('@/features/entries/api', () => ({
  useEntries: vi.fn(),
}));

describe('GroupDraw', () => {
  const mockPreviewMutate = vi.fn();
  const mockPublishMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(eventsApi.useEvent).mockReturnValue({
      data: {
        id: 'e1',
        tournamentId: 't1',
        discipline: 'MD',
        gradeMin: 'RK1',
        gradeMax: 'P+',
        requiresFreshAssessment: false,
        minReviewers: 2,
        format: {
          type: 'groups_knockout',
          groupSize: 4,
          advancePerGroup: 2,
          bestThirds: 0,
          thirdPlacePlayoff: true,
        },
      } as unknown as eventsApi.Event,
      isLoading: false,
    } as unknown as ReturnType<typeof eventsApi.useEvent>);

    vi.mocked(entriesApi.useEntries).mockReturnValue({
      data: [
        { id: 'en1', eventId: 'e1', status: 'approved', players: [] },
        { id: 'en2', eventId: 'e1', status: 'approved', players: [] },
        { id: 'en3', eventId: 'e1', status: 'approved', players: [] },
        { id: 'en4', eventId: 'e1', status: 'approved', players: [] },
      ] as unknown as entriesApi.Entry[],
      isLoading: false,
    } as unknown as ReturnType<typeof entriesApi.useEntries>);

    vi.mocked(drawApi.useGroups).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof drawApi.useGroups>);

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, _options) => ({
      mutate: (payload?: unknown) => {
        mockPreviewMutate(payload);
      },
      isPending: false,
    } as unknown as ReturnType<typeof drawApi.usePreviewGroups>));

    vi.mocked(drawApi.usePublishDraw).mockImplementation((_options) => ({
      mutate: (payload: unknown) => {
        mockPublishMutate(payload);
      },
      isPending: false,
    } as unknown as ReturnType<typeof drawApi.usePublishDraw>));
  });

  it('previews, requires acknowledgement when there are conflicts, then publishes', async () => {
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((_options) => {
      return {
        mutate: mockPublishMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePublishDraw>;
    });

    render(<GroupDraw eventId="e1" />);

    // Precheck summary rendered
    expect(screen.getByTestId('draw-precheck')).toHaveTextContent(
      'ผู้สมัครอนุมัติแล้ว 4 คู่ · รูปแบบ: แบ่งกลุ่ม · กลุ่มละ 4',
    );

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
      size: 4,
      sameTeamR1Count: 1,
      createdAt: '2026-10-08T00:00:00Z',
      conflicts: [{ matchNo: 1, teamId: 'BC BKK' }],
    };
    act(() => {
      capturedPreviewSuccess?.(conflictDraw);
    });

    // Draw summary rendered with Thai copy 'กลุ่มละ {n} คู่'
    await waitFor(() => {
      expect(screen.getByTestId('draw-summary')).toHaveTextContent(
        'กลุ่มละ 4 คู่ · ทีมเดียวกันชนรอบแรก 1',
      );
    });

    // Conflicts box visible with conflict item
    expect(screen.getByTestId('draw-conflicts')).toBeInTheDocument();
    expect(screen.getByTestId('draw-conflict-item')).toHaveTextContent(
      'ทีม BC BKK ชนกันในรอบแรก',
    );

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

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((_options) => {
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

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((options) => {
      capturedPublishSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
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
    let capturedPreviewError: ((err: unknown) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewError = options?.onError as unknown as (err: unknown) => void;
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

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
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

  // Proving test (bl-29-1 S1, S2, S3)
  it('explains why the draw cannot start and keeps the groups after publishing', async () => {
    // 1. Event not groups format -> draw-not-groups and no draw-preview button
    vi.mocked(eventsApi.useEvent).mockReturnValueOnce({
      data: {
        id: 'e-ko',
        tournamentId: 't1',
        discipline: 'MS',
        gradeMin: 'RK1',
        gradeMax: 'P+',
        requiresFreshAssessment: false,
        minReviewers: 2,
        format: {
          type: 'knockout',
          groupSize: 4,
          advancePerGroup: 2,
          bestThirds: 0,
          thirdPlacePlayoff: true,
        },
      } as unknown as eventsApi.Event,
      isLoading: false,
    } as unknown as ReturnType<typeof eventsApi.useEvent>);

    const { unmount: unmountNotGroups } = render(<GroupDraw eventId="e-ko" />);

    expect(screen.getByTestId('draw-precheck')).toHaveTextContent(
      'ผู้สมัครอนุมัติแล้ว 4 คู่ · รูปแบบ: น็อคเอาท์ · กลุ่มละ 4',
    );
    const notGroupsEl = screen.getByTestId('draw-not-groups');
    expect(notGroupsEl).toHaveTextContent('รายการนี้ไม่ใช่รูปแบบแบ่งกลุ่ม');
    const linkEl = notGroupsEl.querySelector('a');
    expect(linkEl).toHaveAttribute('href', '/events/e-ko');
    expect(screen.queryByTestId('draw-preview')).toBeNull();

    unmountNotGroups();

    // 2. Groups format with N < groupSize -> button disabled with reason
    vi.mocked(entriesApi.useEntries).mockReturnValueOnce({
      data: [
        { id: 'en1', eventId: 'e1', status: 'approved', players: [] },
        { id: 'en2', eventId: 'e1', status: 'approved', players: [] },
      ] as unknown as entriesApi.Entry[],
      isLoading: false,
    } as unknown as ReturnType<typeof entriesApi.useEntries>);

    const { unmount: unmountNotEnough } = render(<GroupDraw eventId="e1" />);

    expect(screen.getByTestId('draw-precheck')).toHaveTextContent(
      'ผู้สมัครอนุมัติแล้ว 2 คู่ · รูปแบบ: แบ่งกลุ่ม · กลุ่มละ 4',
    );
    const previewBtn = screen.getByTestId('draw-preview');
    expect(previewBtn).toBeDisabled();
    expect(screen.getByText('ผู้สมัครไม่พอจับกลุ่ม')).toBeInTheDocument();

    unmountNotEnough();

    // 3. Normal flow: N >= groupSize, preview, publish, post-publish summary & groups remain
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;
    let capturedPublishSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    vi.mocked(drawApi.usePublishDraw).mockImplementation((options) => {
      capturedPublishSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
      return {
        mutate: mockPublishMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePublishDraw>;
    });

    const mockPublishedGroups: drawApi.Group[] = [
      {
        id: 'g1',
        label: 'A',
        members: [
          { entryId: 'en1', entry: { displayName: 'คู่ 1' } },
          { entryId: 'en2', entry: { displayName: 'คู่ 2' } },
          { entryId: 'en3', entry: { displayName: 'คู่ 3' } },
        ],
        matches: [
          { id: 'm1', matchNo: 1, a: 'en1', b: 'en2' } as unknown as NonNullable<drawApi.Group['matches']>[number],
          { id: 'm2', matchNo: 2, a: 'en1', b: 'en3' } as unknown as NonNullable<drawApi.Group['matches']>[number],
          { id: 'm3', matchNo: 3, a: 'en2', b: 'en3' } as unknown as NonNullable<drawApi.Group['matches']>[number],
        ],
      },
      {
        id: 'g2',
        label: 'B',
        members: [
          { entryId: 'en4', entry: { displayName: 'คู่ 4' } },
          { entryId: 'en5', entry: { displayName: 'คู่ 5' } },
          { entryId: 'en6', entry: { displayName: 'คู่ 6' } },
        ],
        matches: [
          { id: 'm4', matchNo: 4, a: 'en4', b: 'en5' } as unknown as NonNullable<drawApi.Group['matches']>[number],
          { id: 'm5', matchNo: 5, a: 'en4', b: 'en6' } as unknown as NonNullable<drawApi.Group['matches']>[number],
          { id: 'm6', matchNo: 6, a: 'en5', b: 'en6' } as unknown as NonNullable<drawApi.Group['matches']>[number],
        ],
      },
    ];

    let isPublishedMock = false;
    vi.mocked(drawApi.useGroups).mockImplementation((_eventId, draw) => {
      if (draw === 'preview') {
        return {
          data: mockPublishedGroups,
          isLoading: false,
        } as unknown as ReturnType<typeof drawApi.useGroups>;
      }
      return {
        data: isPublishedMock ? mockPublishedGroups : undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof drawApi.useGroups>;
    });

    render(<GroupDraw eventId="e1" />);

    // Click preview
    fireEvent.click(screen.getByTestId('draw-preview'));

    act(() => {
      capturedPreviewSuccess?.({
        id: 'd_prov',
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

    // Group cards are rendered
    expect(screen.getAllByTestId('group-card')).toHaveLength(2);

    // Click publish -> dialog opens with match count
    fireEvent.click(screen.getByTestId('draw-publish'));
    expect(screen.getByText('จะสร้าง 6 แมตช์ใน 2 กลุ่ม')).toBeInTheDocument();

    // Confirm publish
    fireEvent.click(screen.getByTestId('confirm-publish'));

    // Simulate publish success
    act(() => {
      isPublishedMock = true;
      capturedPublishSuccess?.({
        id: 'd_prov',
        eventId: 'e1',
        version: 1,
        status: 'published',
        kind: 'group',
        size: 4,
        sameTeamR1Count: 0,
        createdAt: '2026-10-08T00:00:00Z',
      });
    });

    // Post-publish summary is displayed and groups remain visible
    await waitFor(() => {
      expect(screen.getByTestId('draw-published-summary')).toHaveTextContent(
        'เผยแพร่แล้ว: 2 กลุ่ม 6 แมตช์',
      );
    });
    expect(screen.getAllByTestId('group-card')).toHaveLength(2);
    expect(screen.getByTestId('draw-published')).toBeInTheDocument();
  });

  it('names both pairs in conflict item when derivable', async () => {
    let capturedPreviewSuccess: ((draw: drawApi.Draw) => void) | undefined;

    vi.mocked(drawApi.usePreviewGroups).mockImplementation((_eventId, options) => {
      capturedPreviewSuccess = options?.onSuccess as unknown as (draw: drawApi.Draw) => void;
      return {
        mutate: mockPreviewMutate,
        isPending: false,
      } as unknown as ReturnType<typeof drawApi.usePreviewGroups>;
    });

    const mockPreviewGroups: drawApi.Group[] = [
      {
        id: 'g1',
        label: 'A',
        members: [
          {
            entryId: 'en1',
            entry: {
              displayName: 'สมชาย / สมศักดิ์',
              teamNames: ['Red Phoenix'],
            },
          },
          {
            entryId: 'en2',
            entry: {
              displayName: 'วิชัย / วีระ',
              teamNames: ['Red Phoenix'],
            },
          },
        ],
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            a: 'en1',
            b: 'en2',
            aEntry: { displayName: 'สมชาย / สมศักดิ์', teamNames: ['Red Phoenix'] },
            bEntry: { displayName: 'วิชัย / วีระ', teamNames: ['Red Phoenix'] },
          } as unknown as NonNullable<drawApi.Group['matches']>[number],
        ],
      },
    ];

    vi.mocked(drawApi.useGroups).mockImplementation((_eventId, draw) => {
      if (draw === 'preview') {
        return {
          data: mockPreviewGroups,
          isLoading: false,
        } as unknown as ReturnType<typeof drawApi.useGroups>;
      }
      return {
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof drawApi.useGroups>;
    });

    render(<GroupDraw eventId="e1" />);
    fireEvent.click(screen.getByTestId('draw-preview'));

    act(() => {
      capturedPreviewSuccess?.({
        id: 'd_conf',
        eventId: 'e1',
        version: 1,
        status: 'preview',
        kind: 'group',
        size: 4,
        sameTeamR1Count: 1,
        createdAt: '2026-10-08T00:00:00Z',
        conflicts: [{ matchNo: 1, teamId: 'Red Phoenix' }],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('draw-conflicts')).toBeInTheDocument();
    });

    const conflictItem = screen.getByTestId('draw-conflict-item');
    expect(conflictItem).toHaveTextContent(
      'สมชาย / สมศักดิ์ พบ วิชัย / วีระ (ทีมเดียวกัน: Red Phoenix)',
    );
  });

  it('format undefined -> draw-preview button present and not draw-not-groups', () => {
    vi.mocked(eventsApi.useEvent).mockReturnValue({
      data: {
        id: 'e-undef',
        tournamentId: 't1',
        discipline: 'MS',
        gradeMin: 'RK1',
        gradeMax: 'P+',
        requiresFreshAssessment: false,
        minReviewers: 2,
      } as unknown as eventsApi.Event,
      isLoading: false,
    } as unknown as ReturnType<typeof eventsApi.useEvent>);

    vi.mocked(entriesApi.useEntries).mockReturnValue({
      data: [
        { id: 'en1', eventId: 'e-undef', status: 'approved', players: [] },
        { id: 'en2', eventId: 'e-undef', status: 'approved', players: [] },
      ] as unknown as entriesApi.Entry[],
      isLoading: false,
    } as unknown as ReturnType<typeof entriesApi.useEntries>);

    render(<GroupDraw eventId="e-undef" />);

    expect(screen.getByTestId('draw-precheck')).toHaveTextContent(
      'ผู้สมัครอนุมัติแล้ว 2 คู่ · รูปแบบ: ไม่ทราบ',
    );
    expect(screen.getByTestId('draw-precheck')).not.toHaveTextContent('กลุ่มละ');

    const previewBtn = screen.getByTestId('draw-preview');
    expect(previewBtn).toBeInTheDocument();
    expect(previewBtn).not.toBeDisabled();

    expect(screen.queryByTestId('draw-not-groups')).toBeNull();
  });

  it('format null -> draw-not-groups with unconfigured text', () => {
    vi.mocked(eventsApi.useEvent).mockReturnValue({
      data: {
        id: 'e-null',
        tournamentId: 't1',
        discipline: 'MS',
        gradeMin: 'RK1',
        gradeMax: 'P+',
        requiresFreshAssessment: false,
        minReviewers: 2,
        format: null,
      } as unknown as eventsApi.Event,
      isLoading: false,
    } as unknown as ReturnType<typeof eventsApi.useEvent>);

    vi.mocked(entriesApi.useEntries).mockReturnValue({
      data: [
        { id: 'en1', eventId: 'e-null', status: 'approved', players: [] },
      ] as unknown as entriesApi.Entry[],
      isLoading: false,
    } as unknown as ReturnType<typeof entriesApi.useEntries>);

    render(<GroupDraw eventId="e-null" />);

    expect(screen.getByTestId('draw-precheck')).toHaveTextContent(
      'ผู้สมัครอนุมัติแล้ว 1 คู่ · รูปแบบ: ยังไม่ได้ตั้งค่า',
    );
    const notGroupsEl = screen.getByTestId('draw-not-groups');
    expect(notGroupsEl).toHaveTextContent('ยังไม่ได้ตั้งค่ารูปแบบแบ่งกลุ่ม');
    expect(screen.queryByTestId('draw-preview')).toBeNull();
  });
  it('asks for a reason when a preview already exists after a reload', () => {
    vi.mocked(drawApi.useGroups).mockImplementation((_eventId, draw) => ({
      data:
        draw === 'preview'
          ? ([{ id: 'g1', label: 'A', members: [], matches: [] }] as unknown as drawApi.Group[])
          : undefined,
      isLoading: false,
    }) as unknown as ReturnType<typeof drawApi.useGroups>);

    render(<GroupDraw eventId="e1" />);

    fireEvent.click(screen.getByTestId('draw-preview'));

    // No reason-less preview is sent; the reason dialog opens instead.
    expect(mockPreviewMutate).not.toHaveBeenCalled();
    const reasonInput = screen.getByTestId('reason-input');
    fireEvent.change(reasonInput, { target: { value: 'ขอสุ่มใหม่' } });
    fireEvent.click(screen.getByTestId('reason-submit'));
    expect(mockPreviewMutate).toHaveBeenCalledWith({ reason: 'ขอสุ่มใหม่' });
  });
});

