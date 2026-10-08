import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UmpireAssignment } from './UmpireAssignment';
import * as api from './api';

vi.mock('./api');

describe('UmpireAssignment', () => {
  const mockEventId = 'event-1';

  const mockUmpires = [
    { userId: 'umpire-1', displayName: 'สมศักดิ์ เมืองเชียง', courts: ['A', 'B'] },
    { userId: 'umpire-2', displayName: 'จำเนียร เลียมลิสา', courts: [] },
  ];

  const mockMatches = [
    {
      id: 'match-1',
      stage: 'group',
      round: 1,
      a: 'entry-1',
      b: 'entry-2',
      aEntry: { displayName: 'ทีม A' },
      bEntry: { displayName: 'ทีม B' },
      court: 'A',
      umpireId: 'umpire-1',
      status: 'scheduled',
    },
    {
      id: 'match-2',
      stage: 'group',
      round: 1,
      a: 'entry-3',
      b: 'entry-4',
      aEntry: { displayName: 'ทีม C' },
      bEntry: { displayName: 'ทีม D' },
      court: null,
      umpireId: null,
      status: 'scheduled',
    },
  ];

  function renderComponent() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <UmpireAssignment eventId={mockEventId} />
      </QueryClientProvider>,
    );
  }

  it('assigns an umpire and court to a match and flags matches without an umpire', async () => {
    const assignMutationFn = vi.fn().mockResolvedValue({ id: 'match-2', umpireId: 'umpire-1' });
    vi.spyOn(api, 'useEventUmpires').mockReturnValue({
      data: mockUmpires,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(api, 'useEventMatches').mockReturnValue({
      data: mockMatches,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(api, 'useAssignMatch').mockReturnValue({
      mutateAsync: assignMutationFn,
      isPending: false,
    } as any);
    vi.spyOn(api, 'useSaveEventUmpires').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderComponent();

    // Verify banner shows 1 missing umpire
    const banner = screen.getByTestId('umpire-missing');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('แมตช์ที่ยังไม่มีกรรมการ: 1');

    // Find match 2 row and assign umpire
    const matchRow = screen.getByTestId('umpire-match-row-match-2');
    const umpireSelect = matchRow.querySelector('select');
    expect(umpireSelect).toBeInTheDocument();

    fireEvent.change(umpireSelect!, { target: { value: 'umpire-1' } });
    await waitFor(() => {
      expect(assignMutationFn).toHaveBeenCalledWith({
        matchId: 'match-2',
        umpireId: 'umpire-1',
      });
    });

    // Assign court to the same match
    const courtInput = matchRow.querySelector('input');
    await userEvent.clear(courtInput!);
    await userEvent.type(courtInput!, 'B');
    await waitFor(() => {
      expect(assignMutationFn).toHaveBeenCalledWith({
        matchId: 'match-2',
        court: 'B',
      });
    });
  });

  it('saves the umpire list when removing an umpire', async () => {
    const saveMutationFn = vi.fn().mockResolvedValue([]);
    vi.spyOn(api, 'useEventUmpires').mockReturnValue({
      data: mockUmpires,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(api, 'useEventMatches').mockReturnValue({
      data: mockMatches,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(api, 'useAssignMatch').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.spyOn(api, 'useSaveEventUmpires').mockReturnValue({
      mutateAsync: saveMutationFn,
      isPending: false,
    } as any);

    renderComponent();

    const removeBtn = screen.getByTestId('umpire-row-umpire-1').querySelector('button[title="ลบ"]');
    await userEvent.click(removeBtn!);

    await waitFor(() => {
      expect(saveMutationFn).toHaveBeenCalledWith([mockUmpires[1]]);
    });
  });

  it('shows empty state when no umpires', () => {
    vi.spyOn(api, 'useEventUmpires').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(api, 'useEventMatches').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(api, 'useAssignMatch').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.spyOn(api, 'useSaveEventUmpires').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderComponent();

    expect(screen.getByTestId('umpire-empty')).toBeInTheDocument();
    expect(screen.getByTestId('umpire-empty')).toHaveTextContent('ยังไม่ได้เลือกกรรมการสนาม');
  });

  it('shows error with retry button', async () => {
    const refetchFn = vi.fn();
    vi.spyOn(api, 'useEventUmpires').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: refetchFn,
    } as any);
    vi.spyOn(api, 'useEventMatches').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(api, 'useAssignMatch').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.spyOn(api, 'useSaveEventUmpires').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderComponent();

    const errorSection = screen.getByTestId('umpire-error');
    expect(errorSection).toBeInTheDocument();
    expect(errorSection).toHaveTextContent('เกิดข้อผิดพลาด');

    const retryBtn = screen.getByText('ลองใหม่');
    await userEvent.click(retryBtn);
    expect(refetchFn).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    vi.spyOn(api, 'useEventUmpires').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(api, 'useEventMatches').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(api, 'useAssignMatch').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.spyOn(api, 'useSaveEventUmpires').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderComponent();

    const loadingEl = screen.getByTestId('umpire-loading');
    expect(loadingEl).toBeInTheDocument();
    expect(loadingEl).toHaveAttribute('role', 'status');
  });

  it('shows no matches state', () => {
    vi.spyOn(api, 'useEventUmpires').mockReturnValue({
      data: mockUmpires,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(api, 'useEventMatches').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(api, 'useAssignMatch').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.spyOn(api, 'useSaveEventUmpires').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    renderComponent();

    const matchSection = screen.getByTestId('umpire-matches');
    expect(matchSection).toHaveTextContent('ยังไม่มีแมตช์ (จับกลุ่มก่อน)');
  });
});
