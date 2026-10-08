import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalibrationSets } from './CalibrationSets';
import * as api from './api';

vi.mock('./api');

const mockApi = api as typeof api & {
  useCalibrationSets: typeof api.useCalibrationSets;
  useCreateCalibrationSet: typeof api.useCreateCalibrationSet;
};

describe('CalibrationSets', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  const render_ = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  it('lists calibration sets and creates a new one', async () => {
    const mockSet1: api.CalibrationSet = {
      id: '1',
      name: 'Set 1',
      period: '2026-Q1',
      clips: [{ clipId: 'clip1', referenceKey: 'S' }, { clipId: 'clip2', referenceKey: 'P' }],
      createdAt: '2026-01-01T00:00:00Z',
    };
    const mockSet2: api.CalibrationSet = {
      id: '2',
      name: 'Set 2',
      period: '2026-Q2',
      clips: [{ clipId: 'clip3', referenceKey: 'N' }],
      createdAt: '2026-01-02T00:00:00Z',
    };

    const mockMutate = vi.fn().mockResolvedValue(mockSet1);

    vi.mocked(mockApi.useCalibrationSets).mockReturnValue({
      data: [mockSet1, mockSet2],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    } as any);

    render_(
      <CalibrationSets />,
    );

    // Check cards
    const cards = screen.getAllByTestId('calibration-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Set 1');
    expect(cards[0]).toHaveTextContent('2026-Q1');
    expect(cards[0]).toHaveTextContent('คลิป 2 คลิป');
    expect(cards[0]).toHaveAttribute('href', '/committee/calibration/1');

    expect(cards[1]).toHaveTextContent('Set 2');
    expect(cards[1]).toHaveTextContent('2026-Q2');
    expect(cards[1]).toHaveTextContent('คลิป 1 คลิป');
    expect(cards[1]).toHaveAttribute('href', '/committee/calibration/2');

    // Submit form
    const nameInput = screen.getByLabelText('ชื่อชุด') as HTMLInputElement;
    const periodInput = screen.getByLabelText('รอบ (ไม่บังคับ)') as HTMLInputElement;
    const submitButton = screen.getByText('สร้างชุด');

    fireEvent.change(nameInput, { target: { value: 'New Set' } });
    fireEvent.change(periodInput, { target: { value: '2026-Q3' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ name: 'New Set', period: '2026-Q3' });
    });

    // Test: period omitted when empty
    fireEvent.change(nameInput, { target: { value: 'Another Set' } });
    fireEvent.change(periodInput, { target: { value: '' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ name: 'Another Set' });
    });
  });

  it('shows empty state when no sets', () => {
    vi.mocked(mockApi.useCalibrationSets).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(
      <CalibrationSets />,
    );

    expect(screen.getByTestId('calibration-empty')).toHaveTextContent('ยังไม่มีชุดมาตรฐาน');
  });

  it('shows error state with retry', () => {
    const mockRefetch = vi.fn();
    vi.mocked(mockApi.useCalibrationSets).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Load failed'),
      refetch: mockRefetch,
    } as any);

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(
      <CalibrationSets />,
    );

    const errorDiv = screen.getByTestId('calibration-error');
    expect(errorDiv).toHaveAttribute('role', 'alert');
    expect(errorDiv).toHaveTextContent('เกิดข้อผิดพลาด');

    const retryButton = screen.getByText('ลองใหม่');
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows create error with thaiError', async () => {
    const createError = new Error('UMPIRE_NOT_ELIGIBLE');
    const mockMutate = vi.fn().mockRejectedValue(createError);

    vi.mocked(mockApi.useCalibrationSets).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    } as any);

    render_(
      <CalibrationSets />,
    );

    const nameInput = screen.getByLabelText('ชื่อชุด');
    const submitButton = screen.getByText('สร้างชุด');

    fireEvent.change(nameInput, { target: { value: 'Test Set' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const errorDiv = screen.getByTestId('calibration-create-error');
      expect(errorDiv).toHaveAttribute('role', 'alert');
      expect(errorDiv).toHaveTextContent('ไม่สามารถสร้างชุดได้');
    });
  });

  it('disables submit button while pending or name empty', () => {
    vi.mocked(mockApi.useCalibrationSets).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);

    const { rerender } = render_(
      <CalibrationSets />,
    );

    let submitButton = screen.getByText('กำลังสร้าง…') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    rerender(
      <QueryClientProvider client={queryClient}>
        <CalibrationSets />
      </QueryClientProvider>,
    );

    submitButton = screen.getByText('สร้างชุด') as HTMLButtonElement;
    expect(submitButton).toBeDisabled(); // empty name
  });

  it('shows loading state', () => {
    vi.mocked(mockApi.useCalibrationSets).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateCalibrationSet).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(
      <CalibrationSets />,
    );

    const loadingDiv = screen.getByTestId('calibration-loading');
    expect(loadingDiv).toHaveAttribute('role', 'status');
    expect(loadingDiv).toHaveTextContent('กำลังโหลด…');
  });
});
