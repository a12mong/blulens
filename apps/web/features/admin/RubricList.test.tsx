import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RubricList } from './RubricList';
import * as api from './api';

vi.mock('./api');

const mockApi = api as typeof api & {
  useRubrics: typeof api.useRubrics;
  useCreateRubric: typeof api.useCreateRubric;
  useDeleteRubric: typeof api.useDeleteRubric;
};

describe('RubricList', () => {
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

  it('shows rubrics list and allows create and delete', async () => {
    const mockRubrics = [
      {
        id: 'draft-1',
        name: 'มาตรฐาน v1',
        methodVersion: '1.0',
        createdAt: '2026-10-01T00:00:00Z',
        activatedAt: null,
        criteria: [],
      },
      {
        id: 'active-1',
        name: 'มาตรฐาน v2',
        methodVersion: '1.0',
        createdAt: '2026-10-02T00:00:00Z',
        activatedAt: '2026-10-03T00:00:00Z',
        criteria: [],
      },
    ];

    const createMutate = vi.fn().mockResolvedValue(mockRubrics[0]);
    vi.mocked(mockApi.useRubrics).mockReturnValue({
      data: mockRubrics,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateRubric).mockReturnValue({
      mutateAsync: createMutate,
      isPending: false,
    } as any);

    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(mockApi.useDeleteRubric).mockReturnValue({
      mutateAsync: deleteMutate,
      isPending: false,
    } as any);

    render_(<RubricList />);

    // Verify rubrics displayed
    expect(screen.getByText('มาตรฐาน v1')).toBeInTheDocument();
    expect(screen.getByText('มาตรฐาน v2')).toBeInTheDocument();

    // Verify in-use badge
    const cards = screen.getAllByTestId('rubric-card');
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveTextContent('กำลังใช้');

    // Test create
    const input = screen.getByPlaceholderText('เช่น มาตรฐานแบดมินตัน v1');
    fireEvent.change(input, { target: { value: 'test rubric' } });
    const createBtn = screen.getByTestId('rubric-create-btn');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith({ name: 'test rubric' });
    });

    // Test delete on draft rubric
    const deleteBtns = screen.getAllByTestId('rubric-delete-btn');
    fireEvent.click(deleteBtns[0]); // draft rubric delete

    await waitFor(() => {
      expect(screen.getByText('ลบรูบริก')).toBeInTheDocument();
    });

    const confirmDeleteBtn = screen.getByText('ลบ', { selector: 'button' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith('draft-1');
    });
  });

  it('disabled set has no delete button active', () => {
    const mockRubrics = [
      {
        id: 'active-1',
        name: 'มาตรฐาน v2',
        methodVersion: '1.0',
        createdAt: '2026-10-02T00:00:00Z',
        activatedAt: '2026-10-03T00:00:00Z',
        criteria: [],
      },
    ];

    vi.mocked(mockApi.useRubrics).mockReturnValue({
      data: mockRubrics,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useDeleteRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<RubricList />);

    const deleteBtn = screen.getByTestId('rubric-delete-btn');
    expect(deleteBtn).toBeDisabled();
  });

  it('shows loading and error states', async () => {
    vi.mocked(mockApi.useRubrics).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render_(<RubricList />);
    expect(screen.getByTestId('rubric-loading')).toBeInTheDocument();
  });

  it('shows error with retry button', async () => {
    const error = new Error('Network error');
    const refetch = vi.fn();

    vi.mocked(mockApi.useRubrics).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: error as any,
      refetch,
    } as any);

    render_(<RubricList />);

    expect(screen.getByTestId('rubric-error')).toBeInTheDocument();
    const retryBtn = screen.getByText('ลองใหม่');
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('shows empty state', async () => {
    vi.mocked(mockApi.useRubrics).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(mockApi.useCreateRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(mockApi.useDeleteRubric).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render_(<RubricList />);

    expect(screen.getByTestId('rubric-empty')).toBeInTheDocument();
    expect(screen.getByText('ยังไม่มีรูบริก')).toBeInTheDocument();
  });
});
