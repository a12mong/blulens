import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClipUploader } from './ClipUploader';
import * as uploadApi from './uploadApi';
import { ApiRequestError } from '@/lib/api/client';

vi.mock('./uploadApi');

const mockUploadApi = uploadApi as typeof uploadApi & {
  useRequestClipUpload: typeof uploadApi.useRequestClipUpload;
  useCompleteClip: typeof uploadApi.useCompleteClip;
  putFileWithProgress: typeof uploadApi.putFileWithProgress;
  readVideoDuration: typeof uploadApi.readVideoDuration;
  validateClipFile: typeof uploadApi.validateClipFile;
};

describe('ClipUploader', () => {
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

  it('uploads a valid clip with progress and completes it', async () => {
    const mockClip: uploadApi.Clip = {
      id: 'clip-1',
      status: 'uploaded',
      viewUrl: 'http://example.com/clip-1',
      durationSec: 42,
    };

    const mockFile = new File([new ArrayBuffer(1000000)], 'test.mp4', { type: 'video/mp4' });

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockResolvedValue(42);

    const mockRequestMutate = vi.fn().mockResolvedValue({
      clipId: 'clip-1',
      uploadUrl: 'http://minio.example.com/upload',
      expiresAt: '2026-10-08T13:00:00Z',
    });

    const mockCompleteMutate = vi.fn().mockResolvedValue(mockClip);

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: mockRequestMutate,
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: mockCompleteMutate,
      isPending: false,
    } as any);

    const onUploaded = vi.fn();
    const progressSpy = vi.fn();

    vi.mocked(mockUploadApi.putFileWithProgress).mockImplementation(
      async (url, file, contentType, onProgress) => {
        // Simulate progress
        onProgress(25);
        onProgress(50);
        onProgress(100);
      },
    );

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={onUploaded} />,
    );

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for the final state where onUploaded is called and done message appears
    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(mockClip);
    }, { timeout: 2000 });

    // Verify all the steps were called
    expect(mockUploadApi.validateClipFile).toHaveBeenCalledWith(mockFile);
    expect(mockUploadApi.readVideoDuration).toHaveBeenCalledWith(mockFile);
    expect(mockRequestMutate).toHaveBeenCalledWith({
      fileName: 'test.mp4',
      contentType: 'video/mp4',
      sizeBytes: mockFile.size,
    });
    expect(mockUploadApi.putFileWithProgress).toHaveBeenCalled();
    expect(mockCompleteMutate).toHaveBeenCalledWith({
      clipId: 'clip-1',
      durationSec: 42,
    });

    // Verify the final state
    expect(screen.getByTestId('clip-state')).toHaveTextContent('อัปโหลดแล้ว');
    expect(screen.getByTestId('clip-state')).toHaveTextContent('test.mp4');
    expect(screen.getByTestId('clip-state')).toHaveTextContent('42 วินาที');
  });

  it('shows error for duration > 300 seconds', async () => {
    const mockFile = new File([new ArrayBuffer(100000)], 'long.mp4', { type: 'video/mp4' });

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockResolvedValue(301);

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    const onUploaded = vi.fn();

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={onUploaded} />,
    );

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('clip-error')).toHaveTextContent('คลิปยาวเกิน 5 นาที');
    });

    // useRequestClipUpload should not have been called when duration is too long
    expect(screen.getByTestId('clip-error')).toBeInTheDocument();
  });

  it('shows type error for invalid file type', async () => {
    const mockFile = new File([new ArrayBuffer(100000)], 'test.avi', { type: 'video/avi' });

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue('type');

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={vi.fn()} />,
    );

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('clip-error')).toHaveTextContent('ชนิดไฟล์ไม่รองรับ');
    });
  });

  it('shows API error with thaiError text', async () => {
    const mockFile = new File([new ArrayBuffer(100000)], 'test.mp4', { type: 'video/mp4' });

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockResolvedValue(42);

    const apiError = new ApiRequestError(409, 'CLIP_LIMIT_REACHED', 'Limit reached');
    const mockRequestMutate = vi.fn().mockRejectedValue(apiError);

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: mockRequestMutate,
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={vi.fn()} />,
    );

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('clip-error')).toHaveTextContent('อัปโหลดได้สูงสุด 3 คลิป');
    });
  });

  it('retries upload on PUT failure', async () => {
    const mockFile = new File([new ArrayBuffer(100000)], 'test.mp4', { type: 'video/mp4' });

    const mockClip: uploadApi.Clip = {
      id: 'clip-1',
      status: 'uploaded',
      viewUrl: 'http://example.com/clip-1',
      durationSec: 42,
    };

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockResolvedValue(42);

    const mockRequestMutate = vi.fn()
      .mockRejectedValueOnce(new Error('UPLOAD_FAILED'))
      .mockResolvedValueOnce({
        clipId: 'clip-1',
        uploadUrl: 'http://minio.example.com/upload',
        expiresAt: '2026-10-08T13:00:00Z',
      });

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: mockRequestMutate,
      isPending: false,
    } as any);

    const mockCompleteMutate = vi.fn().mockResolvedValue(mockClip);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: mockCompleteMutate,
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.putFileWithProgress).mockImplementation(
      async (url, file, contentType, onProgress) => {
        onProgress(100);
      },
    );

    const onUploaded = vi.fn();

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={onUploaded} />,
    );

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('clip-error')).toHaveTextContent('อัปโหลดไม่สำเร็จ');
    });

    const retryButton = screen.getByText('ลองใหม่');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockRequestMutate).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(mockClip);
    });
  });

  it('cancels upload and returns to idle state', async () => {
    const mockFile = new File([new ArrayBuffer(100000)], 'test.mp4', { type: 'video/mp4' });

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockResolvedValue(42);

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        clipId: 'clip-1',
        uploadUrl: 'http://minio.example.com/upload',
        expiresAt: '2026-10-08T13:00:00Z',
      }),
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.putFileWithProgress).mockImplementation(
      async (url, file, contentType, onProgress, signal) => {
        onProgress(50);
        // Simulate waiting for upload
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('UPLOAD_ABORTED');
      },
    );

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={vi.fn()} />,
    );

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('clip-progress')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('clip-cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByTestId('clip-state')).toHaveTextContent('ยังไม่ได้เลือกคลิป');
    });
  });

  it('disables button while checking/uploading', async () => {
    const mockFile = new File([new ArrayBuffer(100000)], 'test.mp4', { type: 'video/mp4' });

    vi.mocked(mockUploadApi.validateClipFile).mockReturnValue(null);
    vi.mocked(mockUploadApi.readVideoDuration).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(42), 200)),
    );

    vi.mocked(mockUploadApi.useRequestClipUpload).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockUploadApi.useCompleteClip).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(
      <ClipUploader assessmentId="assessment-1" onUploaded={vi.fn()} />,
    );

    const pickButton = screen.getByTestId('clip-pick') as HTMLButtonElement;
    expect(pickButton).not.toBeDisabled();

    const fileInput = screen.getByTestId('clip-file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    expect(pickButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByTestId('clip-state')).toHaveTextContent('กำลังตรวจไฟล์');
    });
  });
});
