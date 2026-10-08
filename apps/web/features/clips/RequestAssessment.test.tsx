import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestAssessment } from './RequestAssessment';

const createMutate = vi.fn();
const submitMutate = vi.fn();
let onUploadedCb: ((c: unknown) => void) | undefined;

vi.mock('./requestApi', () => ({
  useCreateAssessment: () => ({ mutateAsync: createMutate, isPending: false }),
  useSubmitAssessment: () => ({ mutateAsync: submitMutate, isPending: false }),
}));
vi.mock('./ClipUploader', () => ({
  ClipUploader: ({ onUploaded }: { onUploaded: (c: unknown) => void }) => {
    onUploadedCb = onUploaded;
    return <div data-testid="uploader" />;
  },
}));
vi.mock('@/components/ui/ClipPlayer', () => ({
  ClipPlayer: () => <div data-testid="player" />,
}));

const clip = (id: string) => ({ id, status: 'uploaded', viewUrl: 'http://x/' + id, durationSec: 30 });

describe('RequestAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutate.mockResolvedValue({ id: 'draft-1' });
    submitMutate.mockResolvedValue({ id: 'draft-1' });
  });

  it('creates a draft once, collects clips and submits', async () => {
    render(<RequestAssessment />);
    fireEvent.change(screen.getByTestId('request-note'), { target: { value: 'สวัสดี' } });
    fireEvent.click(screen.getByTestId('request-start'));
    await waitFor(() => expect(screen.getByTestId('uploader')).toBeInTheDocument());
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate).toHaveBeenCalledWith({ note: 'สวัสดี' });

    expect(screen.getByTestId('request-submit')).toBeDisabled();
    expect(screen.getByText('ต้องมีอย่างน้อย 1 คลิป')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('request-submit'));
    expect(submitMutate).not.toHaveBeenCalled();

    onUploadedCb?.(clip('c1'));
    await waitFor(() => expect(screen.getAllByTestId('request-slot')).toHaveLength(1));
    onUploadedCb?.(clip('c2'));
    await waitFor(() => expect(screen.getAllByTestId('request-slot')).toHaveLength(2));
    expect(screen.getByTestId('uploader')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('request-submit'));
    await waitFor(() => expect(screen.getByTestId('request-done')).toBeInTheDocument());
    expect(submitMutate).toHaveBeenCalledWith('draft-1');
  });

  it('hides the uploader at 3 clips', async () => {
    render(<RequestAssessment />);
    fireEvent.click(screen.getByTestId('request-start'));
    await waitFor(() => expect(screen.getByTestId('uploader')).toBeInTheDocument());
    onUploadedCb?.(clip('c1'));
    await waitFor(() => expect(screen.getAllByTestId('request-slot')).toHaveLength(1));
    onUploadedCb?.(clip('c2'));
    await waitFor(() => expect(screen.getAllByTestId('request-slot')).toHaveLength(2));
    onUploadedCb?.(clip('c3'));
    await waitFor(() => expect(screen.getAllByTestId('request-slot')).toHaveLength(3));
    expect(screen.queryByTestId('uploader')).toBeNull();
  });

  it('shows the Thai error when submit fails', async () => {
    submitMutate.mockRejectedValue(new Error('x'));
    render(<RequestAssessment />);
    fireEvent.click(screen.getByTestId('request-start'));
    await waitFor(() => expect(screen.getByTestId('uploader')).toBeInTheDocument());
    onUploadedCb?.(clip('c1'));
    await waitFor(() => expect(screen.getAllByTestId('request-slot')).toHaveLength(1));
    fireEvent.click(screen.getByTestId('request-submit'));
    await waitFor(() => expect(screen.getByTestId('request-error')).toBeInTheDocument());
  });
});
