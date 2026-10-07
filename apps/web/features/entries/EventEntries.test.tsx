import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventEntries } from './EventEntries';

let state: Record<string, unknown> = {};
vi.mock('./api', () => ({ useEntries: () => state }));

describe('EventEntries', () => {
  it('lists entries read-only (no action buttons) and shows errors', () => {
    state = {
      isPending: false,
      isError: false,
      data: [{ id: 'E1', eventId: 'V1', status: 'approved', players: [{ displayName: 'A' }, { displayName: 'B' }], warnings: [] }],
    };
    const { unmount } = render(<EventEntries eventId="V1" />);
    expect(screen.getAllByTestId('entry-row')).toHaveLength(1);
    expect(screen.queryByTestId('entry-approve')).toBeNull();
    expect(screen.queryByTestId('entry-forward')).toBeNull();
    unmount();
    state = { isPending: false, isError: true, error: { message: 'ไม่มีสิทธิ์' } };
    render(<EventEntries eventId="V1" />);
    expect(screen.getByTestId('event-entries-error')).toHaveTextContent('ไม่มีสิทธิ์');
  });
});
