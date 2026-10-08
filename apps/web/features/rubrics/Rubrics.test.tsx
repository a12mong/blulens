import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { RubricList } from './RubricList';
import { RubricEditor, validateRows } from './RubricEditor';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  useRubrics: vi.fn(),
  useCreateRubricDraft: vi.fn(),
  useDeleteRubric: vi.fn(),
  useActivateRubric: vi.fn(),
  useSaveRubric: vi.fn(),
}));

const crit = (key: string, w = 1) => ({ key, nameTh: 'ชื่อ ' + key, weight: w });
const active = { id: 'r1', status: 'active', createdAt: '2026-10-01T00:00:00Z', methodVersion: 'v1', criteria: [crit('footwork', 2)] };
const draft = { id: 'r2', status: 'draft', createdAt: '2026-10-02T00:00:00Z', methodVersion: 'v2', criteria: [crit('footwork', 2), crit('smash', 1)] };

const mutation = (fn = vi.fn().mockResolvedValue(undefined)) => ({ mutateAsync: fn, isPending: false }) as never;
function mockRubrics(items: unknown[]) {
  vi.mocked(api.useRubrics).mockReturnValue({ data: items, isLoading: false, error: null, refetch: vi.fn() } as never);
}

describe('RubricList', () => {
  const create = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockResolvedValue(undefined);
  const act = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.useCreateRubricDraft).mockReturnValue(mutation(create));
    vi.mocked(api.useDeleteRubric).mockReturnValue(mutation(del));
    vi.mocked(api.useActivateRubric).mockReturnValue(mutation(act));
  });

  it('lists rubric versions and manages the draft', async () => {
    mockRubrics([draft, active]);
    render(<RubricList />);
    const cards = screen.getAllByTestId('rubric-card');
    expect(cards).toHaveLength(2);
    const statuses = screen.getAllByTestId('rubric-status').map((e) => e.textContent);
    expect(statuses).toEqual(['ฉบับร่าง', 'ใช้งานอยู่']);
    expect(screen.getByTestId('rubric-edit')).toHaveAttribute('href', '/committee/rubrics/r2');
    expect(screen.queryByTestId('rubric-new-draft')).toBeNull();

    fireEvent.click(screen.getByTestId('rubric-delete'));
    fireEvent.click(screen.getByTestId('rubric-delete-confirm'));
    await waitFor(() => expect(del).toHaveBeenCalledWith('r2'));

    fireEvent.click(screen.getByTestId('rubric-activate'));
    const reason = screen.getByRole('textbox');
    fireEvent.change(reason, { target: { value: 'เกณฑ์ใหม่ไตรมาส 4' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'เปิดใช้' }));
    await waitFor(() => expect(act).toHaveBeenCalledWith({ id: 'r2', reason: 'เกณฑ์ใหม่ไตรมาส 4' }));
  });

  it('creates a draft when only an active rubric exists, and shows the draft-exists error', async () => {
    mockRubrics([active]);
    const { ApiRequestError } = await import('@/lib/api/client');
    create.mockRejectedValueOnce(new ApiRequestError(409, 'RUBRIC_DRAFT_EXISTS', 'x'));
    render(<RubricList />);
    fireEvent.click(screen.getByTestId('rubric-new-draft'));
    await waitFor(() => expect(screen.getByTestId('rubric-action-error')).toHaveTextContent('มีฉบับร่างอยู่แล้ว'));
  });
});

describe('RubricEditor', () => {
  const save = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.useSaveRubric).mockReturnValue(mutation(save));
  });

  it('edits a draft rubric and saves the criteria', async () => {
    mockRubrics([active, draft]);
    render(<RubricEditor rubricId="r2" />);
    const weights = screen.getAllByTestId('crit-weight');
    fireEvent.change(weights[0], { target: { value: '3' } });
    fireEvent.change(screen.getAllByTestId('crit-anchor-Rookie')[0], { target: { value: 'เริ่มหัดตี' } });
    fireEvent.click(screen.getByTestId('crit-add'));
    const names = screen.getAllByTestId('crit-name');
    const keys = screen.getAllByTestId('crit-key');
    fireEvent.change(names[2], { target: { value: 'การเล่นเน็ต' } });
    fireEvent.change(keys[2], { target: { value: 'net_play' } });
    fireEvent.click(screen.getByTestId('rubric-save'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const arg = save.mock.calls[0][0];
    expect(arg.id).toBe('r2');
    expect(arg.criteria).toHaveLength(3);
    expect(arg.criteria[0]).toEqual({ key: 'footwork', nameTh: 'ชื่อ footwork', weight: 3, anchorsTh: { Rookie: 'เริ่มหัดตี' } });
    expect(arg.criteria[1].anchorsTh).toBeUndefined();
    expect(arg.criteria[2]).toEqual({ key: 'net_play', nameTh: 'การเล่นเน็ต', weight: 1 });
  });

  it('blocks save on bad or duplicate keys and out-of-range weights', () => {
    mockRubrics([draft]);
    render(<RubricEditor rubricId="r2" />);
    fireEvent.change(screen.getAllByTestId('crit-key')[1], { target: { value: 'footwork' } });
    expect(screen.getByTestId('rubric-save')).toBeDisabled();
    expect(screen.getByTestId('rubric-invalid')).toBeInTheDocument();
    expect(screen.getByText('คีย์ซ้ำ')).toBeInTheDocument();
    const row = (key: string, weight: string) => ({ uid: 1, key, nameTh: 'x', weight, anchors: {} });
    expect(validateRows([row('Bad Key', '1')])[1]).toBeTruthy();
    expect(validateRows([row('ok_key', '0')])[1]).toBeTruthy();
    expect(validateRows([row('ok_key', '11')])[1]).toBeTruthy();
    expect(validateRows([row('ok_key', '10')])[1]).toBeUndefined();
  });

  it('is read-only for an active rubric, handles not-found and disables remove at one criterion', () => {
    mockRubrics([active]);
    const { unmount } = render(<RubricEditor rubricId="r1" />);
    expect(screen.getByTestId('rubric-readonly')).toBeInTheDocument();
    expect(screen.queryByTestId('rubric-save')).toBeNull();
    unmount();
    const { unmount: u2 } = render(<RubricEditor rubricId="nope" />);
    expect(screen.getByTestId('rubric-notfound')).toBeInTheDocument();
    u2();
    mockRubrics([{ ...draft, criteria: [crit('footwork')] }]);
    render(<RubricEditor rubricId="r2" />);
    expect(screen.getByTestId('crit-remove')).toBeDisabled();
  });
});
