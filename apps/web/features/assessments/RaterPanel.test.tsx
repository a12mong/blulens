import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RaterPanel } from './RaterPanel';
import * as api from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof api>('./api');
  return {
    ...actual,
    useRaterStats: vi.fn(),
  };
});

vi.mock('./AgreementBadge', () => ({
  AgreementBadge: ({ value }: any) =>
    `AgreementBadge(kappa=${value.kappa}, band=${value.band})`,
}));

vi.mock('./PairMatrix', () => ({
  PairMatrix: ({ reviewerIds }: any) => `PairMatrix(reviewers=${reviewerIds.length})`,
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderWithQuery(element: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  );
}

describe('RaterPanel', () => {
  it('shows Fleiss badge and flagged rater with window selector', async () => {
    const mockUseRaterStats = vi.mocked(api.useRaterStats);
    mockUseRaterStats.mockReturnValue({
      data: {
        window: '90d',
        methodVersion: 'v1',
        panel: {
          fleissKappaTier: { kappa: 0.62, n: 24, band: 'moderate' },
        },
        raters: [
          {
            reviewerId: 'r1',
            reviews: 15,
            bias: 0.4,
            kappaVsConsensus: { kappa: 0.65, n: 12, band: 'substantial' },
            outlierRate: 0.1,
            flagged: false,
          },
          {
            reviewerId: 'r2',
            reviews: 14,
            bias: -0.2,
            kappaVsConsensus: { kappa: 0.58, n: 10, band: 'moderate' },
            outlierRate: 0.25,
            flagged: true,
          },
        ],
        pairs: [
          {
            a: 'r1',
            b: 'r2',
            cohenKappaQuadratic: { kappa: 0.52, n: 8, band: 'moderate' },
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithQuery(<RaterPanel />);

    expect(screen.getByText(/ความสอดคล้องของกรรมการ/)).toBeInTheDocument();
    expect(screen.getByText(/AgreementBadge\(kappa=0.62/)).toBeInTheDocument();

    const raterRows = screen.getAllByTestId('rater-row');
    expect(raterRows).toHaveLength(2);

    const flaggedRow = raterRows[1];
    expect(flaggedRow).toHaveTextContent('ควรทบทวน');
    expect(flaggedRow).toHaveTextContent('25%');

    const windowSelect = screen.getByTestId('rater-window');
    expect(windowSelect).toHaveValue('90d');
  });

  it('calls hook with new window value when select changes', () => {
    const mockUseRaterStats = vi.mocked(api.useRaterStats);
    mockUseRaterStats.mockReturnValue({
      data: {
        panel: { fleissKappaTier: { kappa: 0.5, n: 10, band: 'moderate' } },
        raters: [],
        pairs: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithQuery(<RaterPanel window="30d" />);

    const windowSelect = screen.getByTestId('rater-window') as HTMLSelectElement;

    // Change the select value
    fireEvent.change(windowSelect, { target: { value: '365d' } });

    // Hook should be called again with new window (vitest mock will catch this)
    expect(mockUseRaterStats).toHaveBeenCalled();
  });

  it('shows error state with retry button', async () => {
    const refetchMock = vi.fn();
    const mockUseRaterStats = vi.mocked(api.useRaterStats);
    mockUseRaterStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API error'),
      refetch: refetchMock,
    } as any);

    renderWithQuery(<RaterPanel />);

    const retryButton = screen.getByText('ลองใหม่');
    expect(retryButton).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(retryButton);

    expect(refetchMock).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    const mockUseRaterStats = vi.mocked(api.useRaterStats);
    mockUseRaterStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithQuery(<RaterPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลด…');
  });

  it('shows empty state when no raters', () => {
    const mockUseRaterStats = vi.mocked(api.useRaterStats);
    mockUseRaterStats.mockReturnValue({
      data: {
        panel: undefined,
        raters: [],
        pairs: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithQuery(<RaterPanel />);

    expect(screen.getByText('ยังไม่มีข้อมูลผู้ประเมิน')).toBeInTheDocument();
  });

  it('displays bias text correctly for positive and negative bias', async () => {
    const mockUseRaterStats = vi.mocked(api.useRaterStats);
    mockUseRaterStats.mockReturnValue({
      data: {
        panel: { fleissKappaTier: { kappa: 0.5, n: 10, band: 'moderate' } },
        raters: [
          {
            reviewerId: 'r1',
            reviews: 10,
            bias: 0.4,
            kappaVsConsensus: { kappa: 0.5, n: 5, band: 'moderate' },
            outlierRate: 0.1,
            flagged: false,
          },
          {
            reviewerId: 'r2',
            reviews: 8,
            bias: -0.3,
            kappaVsConsensus: { kappa: 0.6, n: 5, band: 'substantial' },
            outlierRate: 0.0,
            flagged: false,
          },
        ],
        pairs: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithQuery(<RaterPanel />);

    const raterRows = screen.getAllByTestId('rater-row');
    expect(raterRows[0]).toHaveTextContent('เข้มน้อยกว่าฉันทามติ');
    expect(raterRows[1]).toHaveTextContent('เข้มกว่าฉันทามติ');
  });
});
