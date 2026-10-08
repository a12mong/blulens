import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminEntryForm } from './AdminEntryForm';

let playerPickerCallCount = 0;
let teamComboboxCallCount = 0;
let forcePlayerDuplicate = false;

vi.mock('@/features/users/PlayerPicker', () => ({
  PlayerPicker: ({ onChange }: any) => {
    const index = playerPickerCallCount++;
    return (
      <div data-testid={`player-picker-${index}`}>
        <button
          onClick={() =>
            onChange({
              userId: forcePlayerDuplicate
                ? 'u1'
                : index === 0
                  ? 'u1'
                  : 'u2',
              displayName: `Player ${index + 1}`,
            })
          }
        >
          Select Player
        </button>
      </div>
    );
  },
}));

vi.mock('@/features/teams/TeamCombobox', () => ({
  TeamCombobox: ({ onChange }: any) => {
    const index = teamComboboxCallCount++;
    return (
      <div data-testid={`team-combobox-${index}`}>
        <button
          onClick={() =>
            onChange({
              teamId: index === 0 ? 't1' : 't2',
              name: `Team ${index + 1}`,
            })
          }
        >
          Select Team
        </button>
      </div>
    );
  },
}));

// Mock the hooks module
const mockCreateEntry = vi.fn();
const mockForwardEntry = vi.fn();

vi.mock('./api', () => ({
  useCreateEntry: (eventId: string, opts?: any) => mockCreateEntry(eventId, opts),
  useForwardEntry: (opts?: any) => mockForwardEntry(opts),
}));

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('AdminEntryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerPickerCallCount = 0;
    teamComboboxCallCount = 0;
    forcePlayerDuplicate = false;
  });

  it('form submission sends exact payload with no name key when empty', () => {
    const queryClient = createQueryClient();
    let capturedPayload: any;

    mockCreateEntry.mockReturnValue({
      mutate: vi.fn((body) => {
        capturedPayload = body;
      }),
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockForwardEntry.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" />
      </QueryClientProvider>,
    );

    // Select both players (u1, u2)
    const playerButtons = screen.getAllByText('Select Player');
    fireEvent.click(playerButtons[0]!);
    fireEvent.click(playerButtons[1]!);

    // Select both teams (t1, t2)
    const teamButtons = screen.getAllByText('Select Team');
    fireEvent.click(teamButtons[0]!);
    fireEvent.click(teamButtons[1]!);

    // Submit form
    const saveDraftBtn = screen.getByTestId('entry-save-draft');
    fireEvent.click(saveDraftBtn);

    // Verify payload structure:
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.players).toHaveLength(2);
    expect(capturedPayload.players[0]).toHaveProperty('userId');
    expect(capturedPayload.players[1]).toHaveProperty('userId');
    expect(capturedPayload.name).toBeUndefined(); // Critical: no name key when empty
  });

  it('buttons disabled until both players picked', () => {
    const queryClient = createQueryClient();

    mockCreateEntry.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockForwardEntry.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" />
      </QueryClientProvider>,
    );

    const saveDraftBtn = screen.getByTestId('entry-save-draft') as HTMLButtonElement;
    const forwardBtn = screen.getByTestId('entry-forward') as HTMLButtonElement;

    expect(saveDraftBtn.disabled).toBe(true);
    expect(forwardBtn.disabled).toBe(true);
  });

  it('duplicate player error prevents submission and calls neither mutation', () => {
    const queryClient = createQueryClient();

    const createMuteMock = vi.fn();
    const forwardMuteMock = vi.fn();

    mockCreateEntry.mockReturnValue({
      mutate: createMuteMock,
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockForwardEntry.mockReturnValue({
      mutate: forwardMuteMock,
      isPending: false,
    });

    forcePlayerDuplicate = true;
    playerPickerCallCount = 0;
    teamComboboxCallCount = 0;

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" />
      </QueryClientProvider>,
    );

    const player1Btn = screen.getAllByText('Select Player')[0]!;
    fireEvent.click(player1Btn); // player1 = u1

    const player2Btn = screen.getAllByText('Select Player')[1]!;
    fireEvent.click(player2Btn); // player2 = u1 (duplicate!)

    const team1Btn = screen.getAllByText('Select Team')[0]!;
    const team2Btn = screen.getAllByText('Select Team')[1]!;
    fireEvent.click(team1Btn);
    fireEvent.click(team2Btn);

    // Error message should appear
    const errorDiv = screen.getByText('เลือกผู้เล่นซ้ำกัน');
    expect(errorDiv).toBeInTheDocument();

    // Both buttons should be disabled
    const saveDraftBtn = screen.getByTestId('entry-save-draft') as HTMLButtonElement;
    const forwardBtn = screen.getByTestId('entry-forward') as HTMLButtonElement;
    expect(saveDraftBtn.disabled).toBe(true);
    expect(forwardBtn.disabled).toBe(true);

    // Try to click save-draft (should do nothing)
    fireEvent.click(saveDraftBtn);
    expect(createMuteMock).not.toHaveBeenCalled();

    // Try to click forward (should do nothing)
    fireEvent.click(forwardBtn);
    expect(forwardMuteMock).not.toHaveBeenCalled();

    forcePlayerDuplicate = false;
  });

  it('renders warnings after save draft', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'draft', warnings: ['MULTI_TEAM'] } as any;

    let createOnSuccess: ((entry: any) => void) | undefined;

    mockCreateEntry.mockImplementation((_eventId: string, opts?: any) => {
      createOnSuccess = opts?.onSuccess;
      return {
        mutate: vi.fn((_body: any) => {
          createOnSuccess?.(mockEntry);
        }),
        mutateAsync: vi.fn(),
        isPending: false,
      };
    });

    mockForwardEntry.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" />
      </QueryClientProvider>,
    );

    const player1Btn = screen.getByTestId('player-picker-0').querySelector('button');
    const player2Btn = screen.getByTestId('player-picker-1').querySelector('button');

    fireEvent.click(player1Btn!);
    fireEvent.click(player2Btn!);

    const saveDraftBtn = screen.getByTestId('entry-save-draft');
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      const warnings = screen.getByTestId('entry-warnings');
      expect(warnings).toBeInTheDocument();
      expect(warnings.textContent).toContain('ผู้เล่นสังกัดหลายสโมสร');
    });
  });

  it('optional name input works', () => {
    const queryClient = createQueryClient();

    mockCreateEntry.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockForwardEntry.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" />
      </QueryClientProvider>,
    );

    const nameInput = screen.getByTestId('entry-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Test Pair' } });

    expect(nameInput.value).toBe('Test Pair');
  });

  it('after forward the panel and warnings stay until the admin chooses', async () => {
    const queryClient = createQueryClient();
    const onDone = vi.fn();

    const createdDraft = {
      id: 'entry-123',
      eventId: 'EV1',
      status: 'draft',
      name: 'กิตติ / สุรชัย',
      warnings: ['GRADE_OUT_OF_BAND'],
    };

    const forwardedResult = {
      ...createdDraft,
      status: 'pending_committee',
      warnings: ['GRADE_OUT_OF_BAND'],
    };

    let forwardOnSuccess: ((entry: any) => void) | undefined;

    mockCreateEntry.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(createdDraft),
      isPending: false,
    });

    mockForwardEntry.mockImplementation((opts?: any) => {
      forwardOnSuccess = opts?.onSuccess;
      return {
        mutate: vi.fn((_body: any) => {
          forwardOnSuccess?.(forwardedResult);
        }),
        isPending: false,
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" onDone={onDone} />
      </QueryClientProvider>,
    );

    // Pick two players
    const player1Btn = screen.getByTestId('player-picker-0').querySelector('button');
    const player2Btn = screen.getByTestId('player-picker-1').querySelector('button');
    fireEvent.click(player1Btn!);
    fireEvent.click(player2Btn!);

    // Click forward
    const forwardBtn = screen.getByTestId('entry-forward');
    fireEvent.click(forwardBtn);

    // entry-forwarded visible with Thai out-of-band text
    await waitFor(() => {
      expect(screen.getByTestId('entry-forwarded')).toBeInTheDocument();
    });

    expect(screen.getByText('ส่งให้คณะกรรมการแล้ว')).toBeInTheDocument();
    expect(screen.getByText('กิตติ / สุรชัย')).toBeInTheDocument();
    expect(screen.getByTestId('entry-warnings')).toHaveTextContent(
      'เกรดอยู่นอกช่วงของประเภทนี้',
    );

    // onDone NOT called yet
    expect(onDone).not.toHaveBeenCalled();

    // Click entry-add-another -> form is back and empty
    const addAnotherBtn = screen.getByTestId('entry-add-another');
    fireEvent.click(addAnotherBtn);

    expect(screen.queryByTestId('entry-forwarded')).toBeNull();
    expect(screen.getByTestId('entry-forward')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-warnings')).toBeNull();
  });

  it('clicking entry-done calls onDone with the forwarded entry', async () => {
    const queryClient = createQueryClient();
    const onDone = vi.fn();

    const createdDraft = {
      id: 'entry-456',
      eventId: 'EV1',
      status: 'draft',
      name: 'สมชาย / วิภา',
      warnings: ['NO_APPROVED_GRADE'],
    };

    const forwardedResult = {
      ...createdDraft,
      status: 'pending_committee',
      warnings: ['NO_APPROVED_GRADE'],
    };

    let forwardOnSuccess: ((entry: any) => void) | undefined;

    mockCreateEntry.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(createdDraft),
      isPending: false,
    });

    mockForwardEntry.mockImplementation((opts?: any) => {
      forwardOnSuccess = opts?.onSuccess;
      return {
        mutate: vi.fn((_body: any) => {
          forwardOnSuccess?.(forwardedResult);
        }),
        isPending: false,
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" onDone={onDone} />
      </QueryClientProvider>,
    );

    const player1Btn = screen.getByTestId('player-picker-0').querySelector('button');
    const player2Btn = screen.getByTestId('player-picker-1').querySelector('button');
    fireEvent.click(player1Btn!);
    fireEvent.click(player2Btn!);

    const forwardBtn = screen.getByTestId('entry-forward');
    fireEvent.click(forwardBtn);

    await waitFor(() => {
      expect(screen.getByTestId('entry-forwarded')).toBeInTheDocument();
    });

    expect(onDone).not.toHaveBeenCalled();

    const doneBtn = screen.getByTestId('entry-done');
    fireEvent.click(doneBtn);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(forwardedResult);
  });

  it('club field is disabled with hint until player is chosen, and label shows player name', () => {
    const queryClient = createQueryClient();

    mockCreateEntry.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockForwardEntry.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" />
      </QueryClientProvider>,
    );

    // Verify card headings
    expect(screen.getByRole('heading', { level: 2, name: 'ผู้เล่นที่ 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'ผู้เล่นที่ 2' })).toBeInTheDocument();

    // Verify multi-club help text appears exactly once
    expect(screen.getAllByText('ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม')).toHaveLength(1);

    // Initial state: both club inputs disabled with placeholder 'เลือกผู้เล่นก่อน'
    const team1Container = screen.getByTestId('entry-team-1');
    const input1 = team1Container.querySelector('input')!;
    expect(input1).toBeDisabled();
    expect(input1).toHaveAttribute('placeholder', 'เลือกผู้เล่นก่อน');
    expect(team1Container).toHaveTextContent('เลือกผู้เล่นก่อน');

    const team2Container = screen.getByTestId('entry-team-2');
    const input2 = team2Container.querySelector('input')!;
    expect(input2).toBeDisabled();
    expect(input2).toHaveAttribute('placeholder', 'เลือกผู้เล่นก่อน');
    expect(team2Container).toHaveTextContent('เลือกผู้เล่นก่อน');

    // Pick Player 1
    const p1Btn = screen.getAllByText('Select Player')[0]!;
    fireEvent.click(p1Btn);

    // Player 1 club is now active TeamCombobox with label 'สโมสรของ Player 1'
    expect(screen.getByText('Select Team')).toBeInTheDocument();
    expect(screen.getByText('สโมสรของ Player 1')).toBeInTheDocument();

    // Player 2 club remains disabled
    const input2AfterP1 = screen.getByTestId('entry-team-2').querySelector('input')!;
    expect(input2AfterP1).toBeDisabled();

    // Pick Player 2
    const p2Btn = screen.getAllByText('Select Player')[1]!;
    fireEvent.click(p2Btn);

    // Player 2 club is now active TeamCombobox with label for Player 2
    const teamBtns = screen.getAllByText('Select Team');
    expect(teamBtns).toHaveLength(2);
    expect(screen.getByTestId('entry-team-2')).toHaveTextContent(/สโมสรของ Player/);
  });
});

