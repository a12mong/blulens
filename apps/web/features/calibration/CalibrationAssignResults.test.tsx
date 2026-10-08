import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import * as usersApi from '@/features/users/api';
import { CalibrationResults, biasText } from './CalibrationResults';
import { CalibrationAssign } from './CalibrationAssign';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  useCalibrationResults: vi.fn(),
  useAssignCalibration: vi.fn(),
}));
vi.mock('@/features/users/api', async (orig) => ({
  ...(await orig<typeof import('@/features/users/api')>()),
  useReviewerSearch: vi.fn(),
}));

describe('CalibrationResults', () => {
  it("shows each reviewer's bias with a direction and flags thin data", () => {
    vi.mocked(api.useCalibrationResults).mockReturnValue({
      data: [
        { reviewerId: 'r1', clipsScored: 5, biasVsReference: 0.6, meanAbsError: 0.8 },
        { reviewerId: 'r2', clipsScored: 1, biasVsReference: -1, meanAbsError: 1 },
        { reviewerId: 'r3', clipsScored: 4, biasVsReference: 0.1, meanAbsError: 0.3 },
        { reviewerId: 'r4', clipsScored: 4, biasVsReference: -0.7, meanAbsError: 0.7 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    render(<CalibrationResults setId="s1" names={{ r1: 'สมชาย' }} />);
    const rows = screen.getAllByTestId('calib-result-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('สมชาย');
    expect(rows[0]).toHaveTextContent('+0.6');
    expect(rows[0]).toHaveTextContent('สูงกว่าเกณฑ์');
    expect(rows[1]).toHaveTextContent('—');
    expect(rows[1]).toHaveTextContent('ข้อมูลยังไม่พอ');
    expect(rows[2]).toHaveTextContent('ตรงเกณฑ์');
    expect(rows[3]).toHaveTextContent('-0.7');
    expect(rows[3]).toHaveTextContent('ต่ำกว่าเกณฑ์');
    expect(biasText({ reviewerId: 'x', clipsScored: 2, biasVsReference: 0.25, meanAbsError: 0 }).text).toContain('+0.3');
  });

  it('shows empty and error states', () => {
    vi.mocked(api.useCalibrationResults).mockReturnValue({ data: [], isLoading: false, error: null } as never);
    const { unmount } = render(<CalibrationResults setId="s1" names={{}} />);
    expect(screen.getByTestId('calib-results-empty')).toBeInTheDocument();
    unmount();
    vi.mocked(api.useCalibrationResults).mockReturnValue({ data: undefined, isLoading: false, error: new Error('x'), refetch: vi.fn() } as never);
    render(<CalibrationResults setId="s1" names={{}} />);
    expect(screen.getByTestId('calib-results-error')).toBeInTheDocument();
  });
});

describe('CalibrationAssign', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue(undefined);
    vi.mocked(api.useAssignCalibration).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(usersApi.useReviewerSearch).mockReturnValue({
      data: [
        { id: 'u1', displayName: 'ผู้ตรวจ หนึ่ง' },
        { id: 'u2', displayName: 'ผู้ตรวจ สอง' },
      ],
    } as never);
  });

  async function pick(name: string) {
    fireEvent.change(screen.getByTestId('calib-reviewer-search'), { target: { value: 'ผู้' } });
    const opt = (await screen.findAllByTestId('calib-reviewer-option')).find((o) => o.textContent === name)!;
    fireEvent.click(opt);
  }

  it('picks reviewers, confirms and assigns', async () => {
    render(<CalibrationAssign setId="s1" />);
    expect(screen.getByTestId('calib-assign')).toBeDisabled();
    await pick('ผู้ตรวจ หนึ่ง');
    await pick('ผู้ตรวจ สอง');
    expect(screen.getAllByTestId('calib-reviewer-chip')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('calib-assign'));
    expect(screen.getByRole('dialog')).toHaveTextContent('แก้คลิปและเกรดอ้างอิงไม่ได้');
    fireEvent.click(screen.getByTestId('calib-assign-confirm'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ reviewerIds: ['u1', 'u2'], dueAt: undefined }));
  });

  it('shows the Thai text for REVIEWER_NOT_ELIGIBLE', async () => {
    const { ApiRequestError } = await import('@/lib/api/client');
    mutateAsync.mockRejectedValue(new ApiRequestError(409, 'REVIEWER_NOT_ELIGIBLE', 'x'));
    render(<CalibrationAssign setId="s1" alreadyAssigned />);
    await pick('ผู้ตรวจ หนึ่ง');
    fireEvent.click(screen.getByTestId('calib-assign'));
    expect(screen.getByRole('dialog')).toHaveTextContent('เพิ่มผู้ตรวจในชุดที่มอบหมายแล้ว');
    fireEvent.click(screen.getByTestId('calib-assign-confirm'));
    await waitFor(() => expect(screen.getByTestId('calib-assign-error')).toHaveTextContent('ไม่มีสิทธิ์เป็นผู้ประเมิน'));
  });
});
