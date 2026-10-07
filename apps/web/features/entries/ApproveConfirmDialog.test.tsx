import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApproveConfirmDialog } from './ApproveConfirmDialog';
import type { Entry } from './api';

const mockEntry: Entry = {
  id: 'entry-1',
  eventId: 'event-1',
  status: 'pending_committee',
  name: 'Test Entry',
  players: [
    {
      userId: 'user-1',
      displayName: 'Player One',
      grade: {
        score: 7.2,
        lower: 'S',
        upper: 'S+',
        center: 'S',
        label: 'S/S+',
        kind: 'straddle',
      },
    },
    {
      userId: 'user-2',
      displayName: 'Player Two',
      grade: null,
    },
  ],
  warnings: ['MULTI_TEAM', 'NO_APPROVED_GRADE'],
};

describe('ApproveConfirmDialog', () => {
  it('shows player names and grades when open', () => {
    render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Player One')).toBeInTheDocument();
    expect(screen.getByText('S/S+')).toBeInTheDocument();
    expect(screen.getByText('Player Two')).toBeInTheDocument();
    expect(screen.getByText('ยังไม่มีเกรด')).toBeInTheDocument();
  });

  it('displays warnings in Thai', () => {
    render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('ผู้เล่นสังกัดหลายสโมสร')).toBeInTheDocument();
    expect(screen.getByText('ผู้เล่นยังไม่มีเกรดที่อนุมัติ')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={true}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await userEvent.click(screen.getByTestId('approve-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    await userEvent.click(screen.getByTestId('approve-confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('disables buttons while pending', () => {
    render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={true}
        pending={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('approve-confirm')).toBeDisabled();
    expect(screen.getByTestId('approve-cancel')).toBeDisabled();
  });

  it('displays error message', () => {
    const errorMsg = 'การอนุมัติล้มเหลว';
    render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={true}
        error={errorMsg}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <ApproveConfirmDialog
        entry={mockEntry}
        open={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(container.querySelector('[role="alertdialog"]')).not.toBeInTheDocument();
  });
});
