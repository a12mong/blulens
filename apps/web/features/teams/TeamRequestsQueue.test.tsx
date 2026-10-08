import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { TeamRequestsQueue } from './TeamRequestsQueue';
import { ApiRequestError } from '@/lib/api/client';
import type { TeamRequest } from './requestsApi';

const mockUseTeamRequests = vi.fn();
const mockUseResolveTeamRequest = vi.fn();
const mockUseMe = vi.fn();

vi.mock('./requestsApi', async () => {
  const actual = await vi.importActual('./requestsApi');
  return {
    ...actual,
    useTeamRequests: () => mockUseTeamRequests(),
    useResolveTeamRequest: () => mockUseResolveTeamRequest(),
  };
});

vi.mock('@/features/auth/api', () => ({
  useMe: () => mockUseMe(),
}));

const req1: TeamRequest = {
  id: 'req-1',
  name: 'Badminton Club A',
  requestedBy: 'user-1',
  requestedByName: 'สมชาย',
  status: 'pending',
  createdAt: '2026-10-08T07:00:00.000Z',
  similarTeams: [{ id: 'team-existing-1', name: 'BC A Official' }],
};

const req2: TeamRequest = {
  id: 'req-2',
  name: 'Badminton Club B',
  requestedBy: 'user-2',
  requestedByName: 'วิภา',
  status: 'pending',
  createdAt: '2026-10-08T08:00:00.000Z',
  similarTeams: [
    { id: 'team-existing-2', name: 'BC B Official' },
    { id: 'team-existing-3', name: 'BC Bangkok' },
  ],
};

const req3: TeamRequest = {
  id: 'req-3',
  name: 'Unique Phoenix',
  requestedBy: 'user-3',
  requestedByName: null,
  status: 'pending',
  createdAt: '2026-10-08T09:00:00.000Z',
  similarTeams: [],
};

describe('TeamRequestsQueue', () => {
  let mutateMock: ReturnType<typeof vi.fn>;
  let resetMock: ReturnType<typeof vi.fn>;
  let refetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock = vi.fn();
    resetMock = vi.fn();
    refetchMock = vi.fn();

    mockUseMe.mockReturnValue({
      data: {
        id: 'user-committee-1',
        roles: ['Committee'],
      },
    });

    mockUseResolveTeamRequest.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
      reset: resetMock,
    });
  });

  it('proves full flow: create -> confirm, alias -> select -> confirm, reject -> min length 5 validation', async () => {
    mockUseTeamRequests.mockReturnValue({
      data: [req1, req2, req3],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    // 3 rows rendered
    const rows = screen.getAllByTestId('teamreq-row');
    expect(rows).toHaveLength(3);

    // Displays name, requester chip (with name when present, fallback when null), and date
    expect(screen.getByText('Badminton Club A')).toBeInTheDocument();
    expect(screen.getByText('Badminton Club B')).toBeInTheDocument();
    expect(screen.getByText('Unique Phoenix')).toBeInTheDocument();
    expect(screen.getByText('ผู้ขอ: สมชาย')).toBeInTheDocument();
    expect(screen.getByText('ผู้ขอ: วิภา')).toBeInTheDocument();
    expect(screen.getByText('ผู้ขอ')).toBeInTheDocument();
    expect(screen.getAllByText(/ขอเมื่อ/)).toHaveLength(3);

    // Displays similar teams
    expect(screen.getByText('BC A Official')).toBeInTheDocument();
    expect(screen.getByText('BC B Official')).toBeInTheDocument();
    expect(screen.getByText('BC Bangkok')).toBeInTheDocument();

    // 1. Create team on req1
    const createBtns = screen.getAllByTestId('teamreq-create');
    fireEvent.click(createBtns[0]!);

    // Confirm dialog opens
    const createDialog = screen.getByRole('dialog');
    expect(createDialog).toBeInTheDocument();
    expect(screen.getByText('สร้างทีม "Badminton Club A" ?')).toBeInTheDocument();

    // Click confirm submit in dialog
    const confirmSubmitBtn = screen.getByTestId('confirm-submit');
    fireEvent.click(confirmSubmitBtn);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(
      { requestId: 'req-1', action: 'create_team' },
      expect.any(Object),
    );

    // Simulate mutation success
    const createSuccessCb = mutateMock.mock.calls[0]![1]?.onSuccess;
    act(() => {
      createSuccessCb?.();
    });

    // 2. Alias to team on req2
    const aliasBtns = screen.getAllByTestId('teamreq-alias');
    fireEvent.click(aliasBtns[1]!);

    const aliasDialog = screen.getByRole('dialog');
    expect(aliasDialog).toBeInTheDocument();
    expect(within(aliasDialog).getByText('ผูกเป็นชื่อเรียกอื่น')).toBeInTheDocument();

    const aliasSubmitBtn = screen.getByTestId('alias-submit');
    // Disabled before selecting a team
    expect(aliasSubmitBtn).toBeDisabled();

    // Select the first radio option (BC B Official)
    const radioOption = screen.getByRole('radio', { name: 'BC B Official' });
    fireEvent.click(radioOption);
    expect(aliasSubmitBtn).not.toBeDisabled();

    fireEvent.click(aliasSubmitBtn);
    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock).toHaveBeenCalledWith(
      { requestId: 'req-2', action: 'alias_to_team', teamId: 'team-existing-2' },
      expect.any(Object),
    );

    // Simulate alias mutation success
    const aliasSuccessCb = mutateMock.mock.calls[1]![1]?.onSuccess;
    act(() => {
      aliasSuccessCb?.();
    });

    // 3. Reject on req3
    const rejectBtns = screen.getAllByTestId('teamreq-reject');
    fireEvent.click(rejectBtns[2]!);

    const rejectDialog = screen.getByRole('dialog');
    expect(rejectDialog).toBeInTheDocument();
    expect(screen.getByText('ปฏิเสธคำขอสร้างทีม "Unique Phoenix"')).toBeInTheDocument();

    const reasonInput = screen.getByTestId('reason-input');
    const reasonSubmitBtn = screen.getByTestId('reason-submit');

    // 4 characters -> disabled
    fireEvent.change(reasonInput, { target: { value: 'abcd' } });
    expect(reasonSubmitBtn).toBeDisabled();

    // 5 characters -> enabled
    fireEvent.change(reasonInput, { target: { value: 'abcde' } });
    expect(reasonSubmitBtn).not.toBeDisabled();

    fireEvent.click(reasonSubmitBtn);
    expect(mutateMock).toHaveBeenCalledTimes(3);
    expect(mutateMock).toHaveBeenCalledWith(
      { requestId: 'req-3', action: 'reject', reason: 'abcde' },
      expect.any(Object),
    );
  });

  it('renders empty state when no requests exist', () => {
    mockUseTeamRequests.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    expect(screen.getByText('ไม่มีคำขอทีม')).toBeInTheDocument();
    expect(screen.queryByTestId('teamreq-row')).not.toBeInTheDocument();
  });

  it('renders loading skeleton while fetching requests', () => {
    mockUseTeamRequests.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    expect(screen.getByTestId('teamreq-loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const error = new ApiRequestError(403, 'FORBIDDEN', 'Forbidden');
    mockUseTeamRequests.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    const errorAlert = screen.getByTestId('teamreq-error');
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('คุณไม่มีสิทธิ์ทำรายการนี้')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('displays "ไม่พบทีมที่คล้ายกัน" when no similar teams exist', () => {
    mockUseTeamRequests.mockReturnValue({
      data: [req3],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    const similarBox = screen.getByTestId('teamreq-similar');
    expect(similarBox).toHaveTextContent('ไม่พบทีมที่คล้ายกัน');
  });

  it('renders read-only view for Admin without Committee role (action buttons hidden)', () => {
    mockUseMe.mockReturnValue({
      data: {
        id: 'admin-only',
        roles: ['Admin'],
      },
    });

    mockUseTeamRequests.mockReturnValue({
      data: [req1],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    expect(screen.getByTestId('teamreq-row')).toBeInTheDocument();
    expect(screen.getByText('Badminton Club A')).toBeInTheDocument();
    expect(screen.queryByTestId('teamreq-create')).not.toBeInTheDocument();
    expect(screen.queryByTestId('teamreq-alias')).not.toBeInTheDocument();
    expect(screen.queryByTestId('teamreq-reject')).not.toBeInTheDocument();
  });

  it('highlights alias button when similar teams exist, and highlights create when none exist', () => {
    mockUseTeamRequests.mockReturnValue({
      data: [req1, req3],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    const aliasBtns = screen.getAllByTestId('teamreq-alias');
    const createBtns = screen.getAllByTestId('teamreq-create');

    // req1 has similar teams -> alias button is primary (bg-primary)
    expect(aliasBtns[0]).toHaveClass('bg-primary');
    // req3 has no similar teams -> create button is primary (bg-primary)
    expect(createBtns[1]).toHaveClass('bg-primary');
  });

  it('disables action buttons while mutation is pending', () => {
    mockUseTeamRequests.mockReturnValue({
      data: [req1],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    mockUseResolveTeamRequest.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
      isError: false,
      error: null,
      reset: resetMock,
    });

    render(<TeamRequestsQueue />);

    expect(screen.getByTestId('teamreq-create')).toBeDisabled();
    expect(screen.getByTestId('teamreq-alias')).toBeDisabled();
    expect(screen.getByTestId('teamreq-reject')).toBeDisabled();
  });

  it('supports canceling dialogs without mutating', () => {
    mockUseTeamRequests.mockReturnValue({
      data: [req1],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<TeamRequestsQueue />);

    // Open create dialog and cancel
    fireEvent.click(screen.getByTestId('teamreq-create'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open alias dialog and cancel
    fireEvent.click(screen.getByTestId('teamreq-alias'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('alias-cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open reject dialog and cancel
    fireEvent.click(screen.getByTestId('teamreq-reject'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reason-cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('displays mutation error in dialogs', () => {
    mockUseTeamRequests.mockReturnValue({
      data: [req1],
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    mockUseResolveTeamRequest.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: true,
      error: new ApiRequestError(409, 'TEAM_EXISTS', 'Team already exists'),
      reset: resetMock,
    });

    render(<TeamRequestsQueue />);

    // Open create dialog - shows error
    fireEvent.click(screen.getByTestId('teamreq-create'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('ทีมนี้มีอยู่แล้ว')).toBeInTheDocument();
  });
});

