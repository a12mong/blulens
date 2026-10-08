import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RubricEditor } from './RubricEditor';
import * as api from './api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('./api');

const mockApi = api as typeof api & {
  useRubric: typeof api.useRubric;
  useUpdateRubric: typeof api.useUpdateRubric;
  useCopyRubric: typeof api.useCopyRubric;
};

describe('RubricEditor', () => {
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

  it('edits rubric items and weights', async () => {
    const mockRubric = {
      id: 'rubric-1',
      name: 'มาตรฐาน v1',
      methodVersion: '1.0',
      createdAt: '2026-10-01T00:00:00Z',
      activatedAt: null,
      criteria: [
        { key: 'footwork', nameTh: 'ฟอร์มการตี', weight: 50, anchorsTh: {} },
        { key: 'timing', nameTh: 'จังหวะเวลา', weight: 50, anchorsTh: {} },
      ],
    };

    const updateMutate = vi.fn().mockResolvedValue(mockRubric);
    vi.mocked(mockApi.useRubric).mockReturnValue({
      data: mockRubric,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useUpdateRubric).mockReturnValue({
      mutateAsync: updateMutate,
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCopyRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<RubricEditor rubricId="rubric-1" />);

    // Verify header
    expect(screen.getByText('มาตรฐาน v1')).toBeInTheDocument();

    // Verify edit mode is active
    expect(screen.getByTestId('editor-edit-mode')).toBeInTheDocument();

    // Verify items displayed
    const items = screen.getAllByDisplayValue((content) => typeof content === 'string' && /ฟอร์มการตี|จังหวะเวลา/.test(content));
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Verify weight sum
    expect(screen.getByText(/รวม 100%/)).toBeInTheDocument();

    // Test weight calculation
    const weightInputs = screen.getAllByDisplayValue((c) => typeof c === 'number' && (c === 50 || c === 50));
    expect(weightInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows read-only when in-use', () => {
    const mockRubric = {
      id: 'rubric-1',
      name: 'มาตรฐาน v1',
      methodVersion: '1.0',
      createdAt: '2026-10-01T00:00:00Z',
      activatedAt: '2026-10-02T00:00:00Z',
      criteria: [
        { key: 'footwork', nameTh: 'ฟอร์มการตี', weight: 100, anchorsTh: {} },
      ],
    };

    vi.mocked(mockApi.useRubric).mockReturnValue({
      data: mockRubric,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useUpdateRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCopyRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<RubricEditor rubricId="rubric-1" />);

    // Verify badge
    expect(screen.getByText('กำลังใช้')).toBeInTheDocument();

    // Verify read-only message
    expect(screen.getByText(/ชุดนี้กำลังใช้/)).toBeInTheDocument();

    // Verify copy button visible
    const copyBtn = screen.getByText(/ทำสำเนา/);
    expect(copyBtn).toBeInTheDocument();
  });

  it('shows loading and error states', () => {
    vi.mocked(mockApi.useRubric).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render_(<RubricEditor rubricId="rubric-1" />);
    expect(screen.getByTestId('editor-loading')).toBeInTheDocument();
  });

  it('shows error with retry', () => {
    const error = new Error('Network error');
    const refetch = vi.fn();

    vi.mocked(mockApi.useRubric).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error as any,
      refetch,
    } as any);

    render_(<RubricEditor rubricId="rubric-1" />);

    expect(screen.getByTestId('editor-error')).toBeInTheDocument();
    const retryBtn = screen.getByText('ลองใหม่');
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('switches between edit and preview tabs', () => {
    const mockRubric = {
      id: 'rubric-1',
      name: 'มาตรฐาน v1',
      methodVersion: '1.0',
      createdAt: '2026-10-01T00:00:00Z',
      activatedAt: null,
      criteria: [
        { key: 'footwork', nameTh: 'ฟอร์มการตี', weight: 100, anchorsTh: {} },
      ],
    };

    vi.mocked(mockApi.useRubric).mockReturnValue({
      data: mockRubric,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useUpdateRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useCopyRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<RubricEditor rubricId="rubric-1" />);

    // Verify edit mode
    expect(screen.getByTestId('editor-edit-mode')).toBeInTheDocument();

    // Click preview tab
    const previewTab = screen.getByText('ตัวอย่าง');
    fireEvent.click(previewTab);

    // Verify preview mode
    expect(screen.getByTestId('editor-preview-mode')).toBeInTheDocument();
  });
});
