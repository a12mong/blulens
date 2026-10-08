import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalibrationDetail } from './CalibrationDetail';
import * as api from './api';
import * as uploadApi from '@/features/clips/uploadApi';
import { ApiRequestError } from '@/lib/api/client';

vi.mock('./api');
vi.mock('@/features/clips/uploadApi');
vi.mock('./CalibrationAssign', () => ({ CalibrationAssign: () => null }));
vi.mock('./CalibrationResults', () => ({ CalibrationResults: () => <div data-testid="calib-results-stub" /> }));
vi.mock('@/components/ui/ClipPlayer', () => ({
  ClipPlayer: () => <div>ClipPlayer</div>,
}));

const mockApi = api as typeof api & {
  useCalibrationSet: typeof api.useCalibrationSet;
  useRequestCalibrationClip: typeof api.useRequestCalibrationClip;
  useCompleteCalibrationClip: typeof api.useCompleteCalibrationClip;
  useUpdateCalibrationClip: typeof api.useUpdateCalibrationClip;
  useDeleteCalibrationClip: typeof api.useDeleteCalibrationClip;
};

const mockUploadApi = uploadApi as typeof uploadApi & {
  validateClipFile: typeof uploadApi.validateClipFile;
  readVideoDuration: typeof uploadApi.readVideoDuration;
  putFileWithProgress: typeof uploadApi.putFileWithProgress;
};

describe('CalibrationDetail', () => {
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

  it('shows clips with reference grades and edits them until the set is assigned', async () => {
    const mockDetail: api.CalibrationSetDetail = {
      id: 'set-1',
      name: 'ชุด A',
      period: '2026-Q4',
      createdAt: '2026-10-01T00:00:00Z',
      assignedAt: null,
      clipDetails: [
        {
          clipId: 'clip-1',
          referenceKey: 'A' as any,
          status: 'uploaded',
          viewUrl: 'http://example.com/clip-1',
          durationSec: 42,
        },
        {
          clipId: 'clip-2',
          referenceKey: 'C' as any,
          status: 'uploaded',
          viewUrl: 'http://example.com/clip-2',
          durationSec: 55,
        },
      ],
      reviewers: [],
    };

    vi.mocked(mockApi.useCalibrationSet).mockReturnValue({
      data: mockDetail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const updateMutate = vi.fn().mockResolvedValue(mockDetail);
    vi.mocked(mockApi.useUpdateCalibrationClip).mockReturnValue({
      mutateAsync: updateMutate,
      isPending: false,
    } as any);

    const deleteMutate = vi.fn().mockResolvedValue(mockDetail);
    vi.mocked(mockApi.useDeleteCalibrationClip).mockReturnValue({
      mutateAsync: deleteMutate,
      isPending: false,
    } as any);

    vi.mocked(mockApi.useRequestCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCompleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockResolvedValue(42);
    vi.mocked(mockUploadApi.putFileWithProgress).mockResolvedValue(undefined);

    render_(<CalibrationDetail setId="set-1" />);

    // Verify header and state
    expect(screen.getByText('ชุด A')).toBeInTheDocument();
    expect(screen.getByTestId('calib-state')).toHaveTextContent('ฉบับร่าง');

    // Verify 2 clips displayed
    const clipRows = screen.getAllByTestId('calib-clip');
    expect(clipRows).toHaveLength(2);

    // Verify add form is visible when not assigned
    expect(screen.getByTestId('calib-add')).toBeInTheDocument();
    expect(screen.getByTestId('calib-pick')).toBeInTheDocument();
  });

  it('assigned set has no edit, no delete, no add form', async () => {
    const mockDetail: api.CalibrationSetDetail = {
      id: 'set-1',
      name: 'ชุด A',
      period: '2026-Q4',
      createdAt: '2026-10-01T00:00:00Z',
      assignedAt: '2026-10-02T00:00:00Z',
      clipDetails: [
        {
          clipId: 'clip-1',
          referenceKey: 'B' as any,
          status: 'uploaded',
          viewUrl: 'http://example.com/clip-1',
          durationSec: 42,
        },
      ],
      reviewers: [
        {
          reviewerId: 'rev-1',
          reviewerName: 'Alice',
          assigned: 1 as any,
          submitted: 0 as any,
        },
      ],
    };

    vi.mocked(mockApi.useCalibrationSet).mockReturnValue({
      data: mockDetail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useRequestCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCompleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useUpdateCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useDeleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<CalibrationDetail setId="set-1" />);

    expect(screen.getByTestId('calib-state')).toHaveTextContent('มอบหมายแล้ว');
    expect(screen.queryByTestId('calib-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calib-clip-delete')).not.toBeInTheDocument();
  });

  it('shows reviewers table when reviewers exist', async () => {
    const mockDetail: api.CalibrationSetDetail = {
      id: 'set-1',
      name: 'ชุด A',
      period: '2026-Q4',
      createdAt: '2026-10-01T00:00:00Z',
      assignedAt: null,
      clipDetails: [],
      reviewers: [
        { reviewerId: 'rev-1', reviewerName: 'Alice', assigned: 1 as any, submitted: 1 as any },
        { reviewerId: 'rev-2', reviewerName: 'Bob', assigned: 1 as any, submitted: 0 as any },
      ],
    };

    vi.mocked(mockApi.useCalibrationSet).mockReturnValue({
      data: mockDetail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useRequestCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCompleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useUpdateCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useDeleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<CalibrationDetail setId="set-1" />);

    expect(screen.getByTestId('calib-reviewers')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows loading and error states', async () => {
    vi.mocked(mockApi.useCalibrationSet).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render_(<CalibrationDetail setId="set-1" />);
    expect(screen.getByTestId('calib-loading')).toBeInTheDocument();
  });

  it('shows error with retry button', async () => {
    const error = new Error('Network error');
    const refetch = vi.fn();

    vi.mocked(mockApi.useCalibrationSet).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error as any,
      refetch,
    } as any);

    render_(<CalibrationDetail setId="set-1" />);

    expect(screen.getByTestId('calib-load-error')).toBeInTheDocument();
    const retryBtn = screen.getByText('ลองใหม่');
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('shows no clips message', async () => {
    const mockDetail: api.CalibrationSetDetail = {
      id: 'set-1',
      name: 'ชุด A',
      period: '2026-Q4',
      createdAt: '2026-10-01T00:00:00Z',
      assignedAt: null,
      clipDetails: [],
      reviewers: [],
    };

    vi.mocked(mockApi.useCalibrationSet).mockReturnValue({
      data: mockDetail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useRequestCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCompleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useUpdateCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useDeleteCalibrationClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<CalibrationDetail setId="set-1" />);

    expect(screen.getByText('ยังไม่มีคลิปในชุด')).toBeInTheDocument();
  });
});
