import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupStageConfirm } from './GroupStageConfirm';
import { ApiRequestError } from '@/lib/api/client';
import type { Match, GroupStanding } from './api';
import { useEventMatches, useStandings } from '@/features/bracket/api';
import { useConfirmGroups } from './api';

vi.mock('@/features/bracket/api', () => ({
  useEventMatches: vi.fn(),
  useStandings: vi.fn(),
}));

vi.mock('./api', () => ({
  useConfirmGroups: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('GroupStageConfirm', () => {
  let mutateMock: ReturnType<typeof vi.fn>;
  let resetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock = vi.fn();
    resetMock = vi.fn();

    (useConfirmGroups as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isSuccess: false,
      error: null,
      reset: resetMock,
    });
  });

  const groupMatch1: Match = {
    id: 'gm1',
    stage: 'group',
    round: 1,
    status: 'confirmed',
    aEntry: { entryId: 'e1', displayName: 'คู่ ก / ข' },
    bEntry: { entryId: 'e2', displayName: 'คู่ ค / ง' },
  };

  const groupMatch2: Match = {
    id: 'gm2',
    stage: 'group',
    round: 1,
    status: 'confirmed',
    aEntry: { entryId: 'e1', displayName: 'คู่ ก / ข' },
    bEntry: { entryId: 'e3', displayName: 'คู่ จ / ฉ' },
  };

  const groupMatch3Reported: Match = {
    id: 'gm3',
    stage: 'group',
    round: 1,
    status: 'reported',
    aEntry: { entryId: 'e2', displayName: 'คู่ ค / ง' },
    bEntry: { entryId: 'e3', displayName: 'คู่ จ / ฉ' },
  };

  const groupMatch3Confirmed: Match = {
    ...groupMatch3Reported,
    status: 'confirmed',
  };

  const mockStandings: GroupStanding[] = [
    {
      groupId: 'g1',
      entryId: 'e1',
      entry: { displayName: 'คู่ ก / ข' },
      rank: 1,
      qualification: 'qualified',
      confirmed: false,
    },
    {
      groupId: 'g1',
      entryId: 'e2',
      entry: { displayName: 'คู่ ค / ง' },
      rank: 2,
      qualification: 'qualified',
      confirmed: false,
    },
    {
      groupId: 'g1',
      entryId: 'e3',
      entry: { displayName: 'คู่ จ / ฉ' },
      rank: 3,
      qualification: 'out',
      confirmed: false,
    },
  ];

  it('keeps the button disabled until every group match is confirmed, then confirms with the qualifiers shown (proving test)', () => {
    // 2 confirmed, 1 reported
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [groupMatch1, groupMatch2, groupMatch3Reported],
    });
    (useStandings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStandings,
    });

    const { rerender } = renderWithClient(<GroupStageConfirm eventId="ev1" />);

    // Panel is visible
    const panel = screen.getByTestId('groupconfirm');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent('รอบกลุ่ม: ยืนยันแล้ว 2 จาก 3 แมตช์');
    expect(panel).toHaveTextContent('ต้องยืนยันครบทุกแมตช์ก่อน (เหลือ 1)');

    // Button is disabled
    const confirmBtn = screen.getByTestId('groupconfirm-button');
    expect(confirmBtn).toBeDisabled();

    // Now update mock so all 3 matches are confirmed
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [groupMatch1, groupMatch2, groupMatch3Confirmed],
    });

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <GroupStageConfirm eventId="ev1" />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('groupconfirm')).toHaveTextContent(
      'รอบกลุ่ม: ยืนยันแล้ว 3 จาก 3 แมตช์',
    );
    expect(
      screen.queryByText(/ต้องยืนยันครบทุกแมตช์ก่อน/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('groupconfirm-button')).toBeEnabled();

    // Click button -> dialog opens
    fireEvent.click(screen.getByTestId('groupconfirm-button'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'ยืนยันผลรอบกลุ่มแล้วจะแก้ผลไม่ได้',
      }),
    ).toBeInTheDocument();

    // Dialog lists qualifiers from useStandings (rank/qualification 'qualified' => names via entry)
    expect(screen.getByText('คู่ ก / ข')).toBeInTheDocument();
    expect(screen.getByText('คู่ ค / ง')).toBeInTheDocument();
    // 'คู่ จ / ฉ' is out, so not in qualifiers
    expect(screen.queryByText('คู่ จ / ฉ')).not.toBeInTheDocument();

    // Click dialog confirm button
    const dialogConfirmBtn = screen.getByTestId('groupconfirm-dialog-confirm');
    fireEvent.click(dialogConfirmBtn);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(undefined, expect.any(Object));

    // Simulate mutation success callback
    const successCb = mutateMock.mock.calls[0]![1]?.onSuccess;
    act(() => {
      successCb?.();
    });

    // On success: dialog closes, done state shown, button hidden
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Mock mutation returning isSuccess: true
    (useConfirmGroups as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isSuccess: true,
      error: null,
      reset: resetMock,
    });

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <GroupStageConfirm eventId="ev1" />
      </QueryClientProvider>,
    );

    const doneEl = screen.getByTestId('groupconfirm-done');
    expect(doneEl).toBeInTheDocument();
    expect(doneEl).toHaveTextContent('ล็อกผลรอบกลุ่มแล้ว');
    expect(
      screen.queryByTestId('groupconfirm-button'),
    ).not.toBeInTheDocument();
  });

  it('no group matches renders nothing', () => {
    // Empty matches
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
    });
    (useStandings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
    });

    const { container, rerender } = renderWithClient(
      <GroupStageConfirm eventId="ev1" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('groupconfirm')).not.toBeInTheDocument();

    // Only knockout matches
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: 'ko1',
          stage: 'knockout',
          round: 1,
          status: 'confirmed',
        },
      ],
    });

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <GroupStageConfirm eventId="ev1" />
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('groupconfirm')).not.toBeInTheDocument();
  });

  it('standings already confirmed shows done immediately', () => {
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [groupMatch1, groupMatch2],
    });
    (useStandings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          ...mockStandings[0],
          confirmed: true,
        },
      ],
    });

    renderWithClient(<GroupStageConfirm eventId="ev1" />);

    const doneEl = screen.getByTestId('groupconfirm-done');
    expect(doneEl).toBeInTheDocument();
    expect(doneEl).toHaveTextContent('ล็อกผลรอบกลุ่มแล้ว');
    expect(
      screen.queryByTestId('groupconfirm-button'),
    ).not.toBeInTheDocument();
  });

  it('shows GROUP_MATCHES_INCOMPLETE error text in the dialog', () => {
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [groupMatch1, groupMatch2, groupMatch3Confirmed],
    });
    (useStandings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStandings,
    });

    const error = new ApiRequestError(
      409,
      'GROUP_MATCHES_INCOMPLETE',
      'Matches incomplete',
    );
    (useConfirmGroups as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isSuccess: false,
      error,
      reset: resetMock,
    });

    renderWithClient(<GroupStageConfirm eventId="ev1" />);

    fireEvent.click(screen.getByTestId('groupconfirm-button'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('ยังมีแมตช์รอบกลุ่มที่ยังไม่ยืนยัน'),
    ).toBeInTheDocument();
  });

  it('cancel button closes the dialog', () => {
    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [groupMatch1, groupMatch2, groupMatch3Confirmed],
    });
    (useStandings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStandings,
    });

    renderWithClient(<GroupStageConfirm eventId="ev1" />);

    fireEvent.click(screen.getByTestId('groupconfirm-button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('groupconfirm-dialog-cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('void and walkover count as completed group matches', () => {
    const voidMatch: Match = {
      id: 'm-void',
      stage: 'group',
      status: 'void',
    };
    const walkoverMatch: Match = {
      id: 'm-wo',
      stage: 'group',
      status: 'walkover',
    };

    (useEventMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [groupMatch1, voidMatch, walkoverMatch],
    });
    (useStandings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStandings,
    });

    renderWithClient(<GroupStageConfirm eventId="ev1" />);

    expect(screen.getByTestId('groupconfirm')).toHaveTextContent(
      'รอบกลุ่ม: ยืนยันแล้ว 3 จาก 3 แมตช์',
    );
    expect(
      screen.queryByText(/ต้องยืนยันครบทุกแมตช์ก่อน/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('groupconfirm-button')).toBeEnabled();
  });
});
