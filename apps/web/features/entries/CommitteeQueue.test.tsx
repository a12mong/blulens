import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommitteeQueue } from './CommitteeQueue';
import * as entriesApi from './api';

vi.mock('./ApproveConfirmDialog', () => ({
  ApproveConfirmDialog: vi.fn(({ open, entry, onConfirm, onCancel, error, pending }) => {
    if (!open) return null;
    return (
      <div data-testid="approve-confirm-dialog">
        <div data-testid="approve-dialog-entry">{entry.id}</div>
        {error && <div data-testid="approve-dialog-error">{error}</div>}
        <button
          data-testid="approve-confirm-btn"
          onClick={onConfirm}
          disabled={pending}
        >
          ยืนยันอนุมัติ
        </button>
        <button
          data-testid="approve-cancel-btn"
          onClick={onCancel}
          disabled={pending}
        >
          ยกเลิก
        </button>
      </div>
    );
  }),
}));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    useCommitteeQueue: vi.fn(),
    useApproveEntry: vi.fn(),
    useRejectEntry: vi.fn(),
  };
});

describe('CommitteeQueue', () => {
  const mockApproveMutate = vi.fn();
  const mockRejectMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(entriesApi.useApproveEntry).mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
    } as unknown as ReturnType<typeof entriesApi.useApproveEntry>);
    vi.mocked(entriesApi.useRejectEntry).mockReturnValue({
      mutate: mockRejectMutate,
      isPending: false,
    } as unknown as ReturnType<typeof entriesApi.useRejectEntry>);
  });

  it('approving an out-of-band entry asks for a 20-char reason before calling approve', () => {
    const oobEntry: entriesApi.Entry = {
      id: 'entry-oob-1',
      eventId: 'ev-1',
      status: 'pending_committee',
      name: 'Alice / Bob',
      warnings: ['GRADE_OUT_OF_BAND'],
      players: [
        { userId: 'u1', displayName: 'Alice' },
        { userId: 'u2', displayName: 'Bob' },
      ],
    };

    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: [oobEntry],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    // Click approve button
    const approveBtn = screen.getByTestId('entry-approve');
    fireEvent.click(approveBtn);

    // Dialog is open, approve not yet called
    const reasonInput = screen.getByTestId('reason-input');
    expect(reasonInput).toBeInTheDocument();
    expect(screen.getByText('อนุมัติเกรดนอกช่วง')).toBeInTheDocument();
    expect(mockApproveMutate).not.toHaveBeenCalled();

    const submitBtn = screen.getByTestId('reason-submit');
    expect(submitBtn).toBeDisabled();

    // Type less than 20 chars
    fireEvent.change(reasonInput, { target: { value: 'สั้นเกินไป' } });
    expect(submitBtn).toBeDisabled();

    // Type 20+ chars
    const reason20Chars = 'ผู้เล่นมีประวัติผ่านเกณฑ์ระดับสากล';
    fireEvent.change(reasonInput, { target: { value: reason20Chars } });
    expect(submitBtn).not.toBeDisabled();

    // Submit dialog
    fireEvent.click(submitBtn);

    expect(mockApproveMutate).toHaveBeenCalledWith(
      {
        entryId: 'entry-oob-1',
        reason: reason20Chars,
      },
      expect.any(Object),
    );
  });

  it('approve without out-of-band warning shows confirm dialog, not calling approve until confirmed', async () => {
    const normalEntry: entriesApi.Entry = {
      id: 'entry-norm-1',
      eventId: 'ev-1',
      status: 'pending_committee',
      name: 'Charlie / Dave',
      warnings: [],
      players: [
        { userId: 'u3', displayName: 'Charlie' },
        { userId: 'u4', displayName: 'Dave' },
      ],
    };

    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: [normalEntry],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    const approveBtn = screen.getByTestId('entry-approve');
    fireEvent.click(approveBtn);

    // Confirm dialog shows, approve not yet called
    expect(screen.getByTestId('approve-confirm-dialog')).toBeInTheDocument();
    expect(mockApproveMutate).not.toHaveBeenCalled();

    // Cancel the dialog
    await userEvent.click(screen.getByTestId('approve-cancel-btn'));
    expect(mockApproveMutate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('approve-confirm-dialog')).not.toBeInTheDocument();

    // Click approve again
    fireEvent.click(screen.getByTestId('entry-approve'));
    expect(screen.getByTestId('approve-confirm-dialog')).toBeInTheDocument();

    // Confirm the approve
    await userEvent.click(screen.getByTestId('approve-confirm-btn'));
    expect(mockApproveMutate).toHaveBeenCalledWith(
      { entryId: 'entry-norm-1' },
      expect.any(Object),
    );
  });

  it('reject needs 10 chars then calls reject with the reason', () => {
    const entry: entriesApi.Entry = {
      id: 'entry-rej-1',
      eventId: 'ev-1',
      status: 'pending_committee',
      name: 'Eve / Frank',
      warnings: [],
      players: [
        { userId: 'u5', displayName: 'Eve' },
        { userId: 'u6', displayName: 'Frank' },
      ],
    };

    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: [entry],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    const rejectBtn = screen.getByTestId('entry-reject');
    fireEvent.click(rejectBtn);

    const reasonInput = screen.getByTestId('reason-input');
    expect(reasonInput).toBeInTheDocument();
    expect(screen.getByText('ปฏิเสธผู้สมัคร')).toBeInTheDocument();

    const submitBtn = screen.getByTestId('reason-submit');
    expect(submitBtn).toBeDisabled();

    // Type 9 chars
    fireEvent.change(reasonInput, { target: { value: '123456789' } });
    expect(submitBtn).toBeDisabled();

    // Type 10 chars
    fireEvent.change(reasonInput, { target: { value: '1234567890' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    expect(mockRejectMutate).toHaveBeenCalledWith(
      {
        entryId: 'entry-rej-1',
        reason: '1234567890',
      },
      expect.any(Object),
    );
  });

  it('approve error message is shown in confirm dialog on approval failure', async () => {
    mockApproveMutate.mockImplementation((_vars, options) => {
      options?.onError?.(new Error('ENTRY_NOT_PENDING'));
    });

    const normalEntry: entriesApi.Entry = {
      id: 'entry-err-1',
      eventId: 'ev-1',
      status: 'pending_committee',
      name: 'Grace / Heidi',
      warnings: [],
      players: [
        { userId: 'u7', displayName: 'Grace' },
        { userId: 'u8', displayName: 'Heidi' },
      ],
    };

    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: [normalEntry],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    fireEvent.click(screen.getByTestId('entry-approve'));

    expect(screen.getByTestId('approve-confirm-dialog')).toBeInTheDocument();
    expect(mockApproveMutate).not.toHaveBeenCalled();

    // Confirm the approve, which triggers the error
    await userEvent.click(screen.getByTestId('approve-confirm-btn'));

    expect(mockApproveMutate).toHaveBeenCalled();
    const errorEl = screen.getByTestId('approve-dialog-error');
    expect(errorEl).toHaveTextContent('ENTRY_NOT_PENDING');
  });

  it('dialog error message is shown in ReasonDialog error alert', () => {
    mockApproveMutate.mockImplementation((_vars, options) => {
      options?.onError?.(new Error('ENTRY_OUT_OF_BAND_REASON_REQUIRED'));
    });

    const oobEntry: entriesApi.Entry = {
      id: 'entry-err-2',
      eventId: 'ev-1',
      status: 'pending_committee',
      name: 'Ivan / Judy',
      warnings: ['GRADE_OUT_OF_BAND'],
      players: [
        { userId: 'u9', displayName: 'Ivan' },
        { userId: 'u10', displayName: 'Judy' },
      ],
    };

    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: [oobEntry],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    fireEvent.click(screen.getByTestId('entry-approve'));

    const reasonInput = screen.getByTestId('reason-input');
    fireEvent.change(reasonInput, {
      target: { value: 'ข้อความอนุมัติยาวเกินยี่สิบตัวอักษรแน่นอน' },
    });
    fireEvent.click(screen.getByTestId('reason-submit'));

    const errorAlert = screen.getByTestId('reason-error');
    expect(errorAlert).toHaveTextContent('ENTRY_OUT_OF_BAND_REASON_REQUIRED');
  });

  it('empty queue shows the table empty state', () => {
    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    const empty = screen.getByTestId('entry-empty');
    expect(empty).toHaveTextContent('ยังไม่มีรายการ');
  });

  it('renders loading state with role="status"', () => {
    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    const loading = screen.getByRole('status');
    expect(loading).toHaveTextContent('กำลังโหลด…');
  });

  it('renders error state with role="alert" and data-testid="queue-error"', () => {
    vi.mocked(entriesApi.useCommitteeQueue).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ'),
    } as unknown as ReturnType<typeof entriesApi.useCommitteeQueue>);

    render(<CommitteeQueue eventId="ev-1" />);

    const errorEl = screen.getByTestId('queue-error');
    expect(errorEl).toHaveTextContent('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    expect(errorEl).toHaveAttribute('role', 'alert');
  });
});
