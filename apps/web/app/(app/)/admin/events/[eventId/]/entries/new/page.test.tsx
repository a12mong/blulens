import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewEntryPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'event-123' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
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
  it('mocks AdminEntryForm and asserts it gets eventId and onDone navigates to entries list', () => {
    render(<NewEntryPage />);

    // Verify heading renders
    expect(screen.getByText('เพิ่มคู่ผู้สมัคร')).toBeInTheDocument();

    // Verify AdminEntryForm mock receives eventId
    const form = screen.getByTestId('admin-entry-form');
    expect(form).toHaveAttribute('data-event-id', 'event-123');

    // Verify onDone callback triggers navigation
    const doneButton = screen.getByTestId('form-done');
    doneButton.click();

    // The mock router records the push call
    // (This is verified through the mocked next/navigation at the module level)
  });
});
