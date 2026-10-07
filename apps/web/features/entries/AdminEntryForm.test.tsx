import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminEntryForm } from './AdminEntryForm';

let playerPickerCallCount = 0;
let teamComboboxCallCount = 0;

vi.mock('@/features/users/PlayerPicker', () => ({
  PlayerPicker: ({ onChange }: any) => {
    const index = playerPickerCallCount++;
    return (
      <div data-testid={`player-picker-${index}`}>
        <button onClick={() => onChange({ userId: index === 0 ? 'u1' : 'u2' })}>
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
        <button onClick={() => onChange({ teamId: index === 0 ? 't1' : 't2' })}>
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
  });

  it('forward creates the draft with two players then forwards it', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'draft', warnings: [] } as any;
    const onDoneMock = vi.fn();

    let createOnSuccess: ((entry: any) => void) | undefined;
    let forwardOnSuccess: ((entry: any) => void) | undefined;

    mockCreateEntry.mockImplementation((eventId: string, opts?: any) => {
      createOnSuccess = opts?.onSuccess;
      return {
        mutate: vi.fn((body: any) => {
          createOnSuccess?.(mockEntry);
        }),
        mutateAsync: vi.fn(async (body: any) => {
          return mockEntry;
        }),
        isPending: false,
      };
    });

    mockForwardEntry.mockImplementation((opts?: any) => {
      forwardOnSuccess = opts?.onSuccess;
      return {
        mutate: vi.fn((vars: any) => {
          forwardOnSuccess?.(mockEntry);
        }),
        isPending: false,
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminEntryForm eventId="EV1" onDone={onDoneMock} />
      </QueryClientProvider>
    );

    // Select players - mocks track call order to differentiate
    const player1Btn = screen.getByTestId('player-picker-0').querySelector('button');
    const player2Btn = screen.getByTestId('player-picker-1').querySelector('button');
    const team1Btn = screen.getByTestId('team-combobox-0').querySelector('button');
    const team2Btn = screen.getByTestId('team-combobox-1').querySelector('button');

    fireEvent.click(player1Btn!);
    fireEvent.click(player2Btn!);
    fireEvent.click(team1Btn!);
    fireEvent.click(team2Btn!);

    const forwardBtn = screen.getByTestId('entry-forward');
    fireEvent.click(forwardBtn);

    // Verify form submits with correct data structure
    await waitFor(() => {
      expect(mockCreateEntry).toHaveBeenCalledWith('EV1', expect.any(Object));
    });

    // Verify onDone was called with the entry
    await waitFor(() => {
      expect(onDoneMock).toHaveBeenCalledWith(mockEntry);
    });
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
      </QueryClientProvider>
    );

    const saveDraftBtn = screen.getByTestId('entry-save-draft') as HTMLButtonElement;
    const forwardBtn = screen.getByTestId('entry-forward') as HTMLButtonElement;

    expect(saveDraftBtn.disabled).toBe(true);
    expect(forwardBtn.disabled).toBe(true);
  });

  it('renders warnings after save draft', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'draft', warnings: ['MULTI_TEAM'] } as any;

    let createOnSuccess: ((entry: any) => void) | undefined;

    mockCreateEntry.mockImplementation((eventId: string, opts?: any) => {
      createOnSuccess = opts?.onSuccess;
      return {
        mutate: vi.fn((body: any) => {
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
      </QueryClientProvider>
    );

    // Select players - mocks track call order to differentiate
    const player1Btn = screen.getByTestId('player-picker-0').querySelector('button');
    const player2Btn = screen.getByTestId('player-picker-1').querySelector('button');

    fireEvent.click(player1Btn!);
    fireEvent.click(player2Btn!);

    const saveDraftBtn = screen.getByTestId('entry-save-draft');
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      const warnings = screen.getByTestId('entry-warnings');
      expect(warnings).toBeInTheDocument();
      expect(warnings.textContent).toContain('ผู้เล่นสังกัดหลายทีม');
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
      </QueryClientProvider>
    );

    const nameInput = screen.getByTestId('entry-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Test Pair' } });

    expect(nameInput.value).toBe('Test Pair');
  });
});
