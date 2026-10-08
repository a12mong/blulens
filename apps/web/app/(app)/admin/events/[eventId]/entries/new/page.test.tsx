import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NewEntryPage from './page';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'event-123' }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockUseEvent = vi.fn();

vi.mock('@/features/events/api', () => ({
  useEvent: (id: string) => mockUseEvent(id),
}));

vi.mock('@/features/entries/AdminEntryForm', () => ({
  AdminEntryForm: ({ eventId, onDone }: { eventId: string; onDone: () => void }) => (
    <div data-testid="admin-entry-form" data-event-id={eventId}>
      <button onClick={onDone} data-testid="form-done">
        Done
      </button>
    </div>
  ),
}));

describe('NewEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the event name in the header', () => {
    mockUseEvent.mockReturnValue({
      data: {
        id: 'event-123',
        tournamentId: 'tour-1',
        tournamentName: 'BluLens Masters 2026',
        discipline: 'MD',
        gradeMin: 'S-',
        gradeMax: 'S+',
        requiresFreshAssessment: false,
        minReviewers: 2,
      },
      isLoading: false,
      isError: false,
    });

    render(<NewEntryPage />);

    const header = screen.getByTestId('new-entry-header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveTextContent('เพิ่มคู่: BluLens Masters 2026 · ชายคู่ S-–S+');
  });

  it('shows back link to entries list', () => {
    mockUseEvent.mockReturnValue({
      data: {
        tournamentName: 'BluLens Masters 2026',
        discipline: 'MD',
        gradeMin: 'S-',
        gradeMax: 'S+',
      },
      isLoading: false,
      isError: false,
    });

    render(<NewEntryPage />);

    const backLink = screen.getByRole('link', { name: /กลับไปรายการผู้สมัคร/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/admin/events/event-123/entries');
  });

  it('renders skeleton while loading', () => {
    mockUseEvent.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<NewEntryPage />);

    expect(screen.getByTestId('new-entry-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('new-entry-header')).not.toBeInTheDocument();
  });

  it('renders thaiError banner on failure', () => {
    mockUseEvent.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load event'),
    });

    render(<NewEntryPage />);

    expect(screen.getByTestId('new-entry-error')).toBeInTheDocument();
    expect(screen.queryByTestId('new-entry-header')).not.toBeInTheDocument();
  });

  it('mocks AdminEntryForm and asserts it gets eventId and onDone navigates to entries list', () => {
    mockUseEvent.mockReturnValue({
      data: {
        tournamentName: 'BluLens Open',
        discipline: 'XD',
        gradeMin: 'P',
        gradeMax: 'P',
      },
      isLoading: false,
      isError: false,
    });

    render(<NewEntryPage />);

    // Verify AdminEntryForm mock receives eventId
    const form = screen.getByTestId('admin-entry-form');
    expect(form).toHaveAttribute('data-event-id', 'event-123');

    // Verify onDone callback triggers navigation
    const doneButton = screen.getByTestId('form-done');
    doneButton.click();

    expect(mockPush).toHaveBeenCalledWith('/admin/events/event-123/entries');
  });
});
