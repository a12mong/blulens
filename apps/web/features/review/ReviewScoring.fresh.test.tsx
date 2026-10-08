import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { ReviewScoring } from './ReviewScoring';
import * as reviewApi from './api';
import * as draftModule from './useReviewDraft';

vi.mock('next/navigation');
vi.mock('./api', () => ({ useAssignment: vi.fn(), useSubmitReview: vi.fn() }));
vi.mock('./useReviewDraft', () => ({ useReviewDraft: vi.fn() }));
vi.mock('@/components/ui/ClipPlayer', () => ({ ClipPlayer: () => <div>clip</div> }));

describe('ReviewScoring with the real RubricItemCard', () => {
  it('a fresh draft shows every criterion as not chosen, not as cannot-assess', () => {
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ push: vi.fn() });
    vi.mocked(reviewApi.useAssignment).mockReturnValue({
      data: {
        id: 'task-1',
        state: 'open',
        dueAt: '2026-10-07T20:00:00Z',
        clips: [],
        rubric: { methodVersion: 'v1', criteria: [{ key: 'footwork', nameTh: 'ฟุตเวิร์ก', weight: 1 }] },
        myScores: [],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof reviewApi.useAssignment>);
    vi.mocked(reviewApi.useSubmitReview).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof reviewApi.useSubmitReview>);
    vi.mocked(draftModule.useReviewDraft).mockReturnValue({
      draft: { scores: {}, comment: '' },
      setScore: vi.fn(),
      setComment: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof draftModule.useReviewDraft>);

    render(<ReviewScoring id="task-1" />);

    expect(screen.getByTestId('rubric-item')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByTestId('rubric-item-status')).toHaveTextContent('ยังไม่เลือก');
    expect(screen.getByTestId('scoring-submit')).toBeDisabled();
  });
});
