import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ReviewScoring } from './ReviewScoring';

vi.mock('next/navigation');
vi.mock('./api', () => ({
  useAssignment: vi.fn(),
  useSubmitReview: vi.fn(),
}));
vi.mock('./useReviewDraft', () => ({
  useReviewDraft: vi.fn(),
}));
vi.mock('@/components/ui/ClipPlayer', () => ({
  ClipPlayer: () => <div>Mock ClipPlayer</div>,
}));
vi.mock('@/features/review/RubricItemCard', () => ({
  RubricItemCard: ({ index, criterion, value, onChange, readOnly }: any) => (
    <div data-testid="rubric-item">
      <h3>
        {index}. {criterion.nameTh}
      </h3>
      <input
        type="checkbox"
        data-testid={`criterion-${criterion.key}`}
        checked={value !== null}
        onChange={(e) => onChange(e.target.checked ? 'S' : null)}
        disabled={readOnly}
      />
      {criterion.nameTh}
    </div>
  ),
}));

import * as reviewApi from './api';
import * as draftModule from './useReviewDraft';

describe('ReviewScoring', () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockPush.mockClear();
    (useRouter as any).mockReturnValue({ push: mockPush });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('submit stays disabled until every criterion is answered', () => {
    const mockData = {
      id: 'task-123',
      state: 'open' as const,
      assessmentId: 'hidden',
      dueAt: '2026-10-07T20:00:00Z',
      clips: [],
      rubric: {
        methodVersion: 1,
        criteria: [
          { key: 'footwork', nameTh: 'ขาเคลื่อน', weight: 0.5, anchorsTh: [] },
          { key: 'smash', nameTh: 'แสง', weight: 0.5, anchorsTh: [] },
        ],
      },
      myScores: [],
    };

    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: mockData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: { scores: {}, comment: '' },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(<ReviewScoring id="task-123" />, { wrapper });

    // Initially submit is disabled
    const submitBtn = screen.getByTestId('scoring-submit');
    expect(submitBtn).toBeDisabled();

    // Check progress shows 0/2
    expect(screen.getByTestId('scoring-progress')).toHaveTextContent('0/2');
  });

  it('submitted state is read-only with back link, comment, and 1-based numbering', () => {
    const mockData = {
      id: 'task-123',
      state: 'submitted' as const,
      assessmentId: 'hidden',
      dueAt: '2026-10-07T20:00:00Z',
      submittedAt: '2026-10-07T19:00:00Z',
      comment: 'เล่นเกมรับดีมาก',
      clips: [],
      rubric: {
        methodVersion: 1,
        criteria: [{ key: 'footwork', nameTh: 'ขาเคลื่อน', weight: 1, anchorsTh: [] }],
      },
      myScores: [{ criterion: 'footwork', gradeKey: 'S' }],
    };

    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: mockData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: { scores: {}, comment: '' },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(<ReviewScoring id="task-123" />, { wrapper });

    expect(screen.getByText('ส่งผลประเมินแล้ว')).toBeInTheDocument();
    expect(screen.queryByTestId('scoring-submit')).not.toBeInTheDocument();

    // R6: keeps '← คิว' link
    const backLink = screen.getByText('← คิว');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/review');

    // R6: shows submitted comment read-only
    const commentBlock = screen.getByTestId('scoring-comment-readonly');
    expect(commentBlock).toHaveTextContent('เล่นเกมรับดีมาก');

    // R9: first rubric card is numbered 1
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('1. ขาเคลื่อน');
  });

  it('warns without blocking when more than half are cannot-assess (proving test)', () => {
    const mockMutate = vi.fn();
    const mockData = {
      id: 'task-456',
      state: 'open' as const,
      assessmentId: 'hidden',
      dueAt: '2026-10-07T20:00:00Z',
      clips: [],
      rubric: {
        methodVersion: 1,
        criteria: [
          { key: 'c1', nameTh: 'เกณฑ์ 1', weight: 1 },
          { key: 'c2', nameTh: 'เกณฑ์ 2', weight: 1 },
          { key: 'c3', nameTh: 'เกณฑ์ 3', weight: 1 },
          { key: 'c4', nameTh: 'เกณฑ์ 4', weight: 1 },
        ],
      },
      myScores: [],
    };

    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: mockData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // 4 criteria, 3 null (cannot assess), 1 graded ('S'), no comment
    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: {
        scores: { c1: null, c2: null, c3: null, c4: 'S' },
        comment: '',
      },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    render(<ReviewScoring id="task-456" />, { wrapper });

    // R9: check first rubric card is numbered 1 in open state
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('1. เกณฑ์ 1');

    // Submit button is enabled since all 4 criteria are answered
    const submitBtn = screen.getByTestId('scoring-submit');
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    // Dialog opens with summary and warning
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const summary = screen.getByTestId('scoring-summary');
    expect(summary).toHaveTextContent('ให้ระดับ 1 · ประเมินไม่ได้ 3 · ความเห็น ไม่มี');

    const warning = screen.getByTestId('scoring-warning');
    expect(warning).toHaveTextContent('ประเมินไม่ได้เกินครึ่ง');

    // Confirm button is NOT blocked
    const confirmBtn = screen.getByTestId('scoring-confirm');
    expect(confirmBtn).toBeEnabled();

    // Clicking confirm calls mutate
    fireEvent.click(confirmBtn);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: [
          { criterion: 'c1', gradeKey: null },
          { criterion: 'c2', gradeKey: null },
          { criterion: 'c3', gradeKey: null },
          { criterion: 'c4', gradeKey: 'S' },
        ],
      }),
      expect.anything()
    );
  });

  it('shows summary without warning when cannot-assess is half or less, and notes comment presence', () => {
    const mockData = {
      id: 'task-789',
      state: 'open' as const,
      assessmentId: 'hidden',
      dueAt: '2026-10-07T20:00:00Z',
      clips: [],
      rubric: {
        methodVersion: 1,
        criteria: [
          { key: 'c1', nameTh: 'เกณฑ์ 1', weight: 1 },
          { key: 'c2', nameTh: 'เกณฑ์ 2', weight: 1 },
          { key: 'c3', nameTh: 'เกณฑ์ 3', weight: 1 },
          { key: 'c4', nameTh: 'เกณฑ์ 4', weight: 1 },
        ],
      },
      myScores: [],
    };

    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: mockData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // 4 criteria, 1 null, 3 graded, with comment
    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: {
        scores: { c1: null, c2: 'S', c3: 'S', c4: 'S' },
        comment: 'มีข้อแนะนำเพิ่มเติม',
      },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(<ReviewScoring id="task-789" />, { wrapper });

    const submitBtn = screen.getByTestId('scoring-submit');
    fireEvent.click(submitBtn);

    const summary = screen.getByTestId('scoring-summary');
    expect(summary).toHaveTextContent('ให้ระดับ 3 · ประเมินไม่ได้ 1 · ความเห็น มี');

    // Warning is NOT shown
    expect(screen.queryByTestId('scoring-warning')).not.toBeInTheDocument();

    const confirmBtn = screen.getByTestId('scoring-confirm');
    expect(confirmBtn).toBeEnabled();
  });

  it('loading state shows skeleton', () => {
    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: { scores: {}, comment: '' },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(<ReviewScoring id="task-123" />, { wrapper });

    expect(screen.getByTestId('scoring-loading')).toBeInTheDocument();
  });

  it('error state shows retry button and link back', () => {
    const mockRefetch = vi.fn();

    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
    } as any);

    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: { scores: {}, comment: '' },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(<ReviewScoring id="task-123" />, { wrapper });

    expect(screen.getByTestId('scoring-error')).toBeInTheDocument();
    expect(screen.getByText('ลองใหม่')).toBeInTheDocument();

    const link = screen.getByText('← คิว');
    expect(link).toHaveAttribute('href', '/review');
  });

  it('never shows assessment id, player name, or calibration indicator', () => {
    const mockData = {
      id: 'task-xyz-abc123',
      state: 'open' as const,
      assessmentId: 'assessment-uuid-should-not-appear',
      dueAt: '2026-10-07T20:00:00Z',
      clips: [],
      rubric: { methodVersion: 1, criteria: [] },
      myScores: [],
    };

    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: mockData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: { scores: {}, comment: '' },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as any);

    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    const { container } = render(<ReviewScoring id="task-xyz-abc123" />, { wrapper });

    const html = container.innerHTML;
    expect(html).not.toContain('assessment-uuid-should-not-appear');
    expect(html).not.toContain('calibration');
    expect(html).not.toContain('ชุดมาตรฐาน');
  });
});
