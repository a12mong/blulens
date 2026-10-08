import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyAssessmentDetail } from './MyAssessmentDetail';
import * as api from '@/features/assessments/api';

vi.mock('@/features/assessments/api');
vi.mock('@/components/ui/ClipPlayer', () => ({ ClipPlayer: () => <div data-testid="player" /> }));

const base = {
  id: 'a1',
  subjectUserId: 'u1',
  status: 'approved',
  createdAt: '2026-10-01T00:00:00Z',
  event: { id: 'e1', discipline: 'MS', tournamentName: 'ทัวร์ A' },
  clips: [{ id: 'c1', status: 'uploaded', viewUrl: 'http://x/c1', durationSec: 20 }],
};
const grade = { score: 7.4, lower: 'S', upper: 'S+', center: 'S', kind: 'straddle', label: 'S/S+' };

function mock(data: unknown, extra: Record<string, unknown> = {}) {
  vi.mocked(api.useAssessmentDetail).mockReturnValue({
    data, isLoading: false, error: null, refetch: vi.fn(), ...extra,
  } as never);
}

describe('MyAssessmentDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the published grade and clips without reviewer details', () => {
    mock({
      ...base,
      latestResult: { version: 2, source: 'override', status: 'approved', grade, nRaters: 3, nExcluded: 1, spread: 2, flags: ['OVERRIDE', 'HIGH_DISAGREEMENT'], methodVersion: 'v1', reason: 'ปรับตามคลิปเพิ่ม', computedAt: '2026-10-05T00:00:00Z' },
    });
    render(<MyAssessmentDetail id="a1" />);
    expect(screen.getByTestId('myassess-status')).toHaveTextContent('ผลประกาศแล้ว');
    expect(screen.getByTestId('myassess-grade')).toHaveTextContent('ระดับ S/S+');
    expect(screen.getByTestId('myassess-reason')).toHaveTextContent('ปรับตามคลิปเพิ่ม');
    expect(screen.getByTestId('myassess-clips')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const w of ['provisional', 'disputed', 'OUTLIER', 'HIGH_DISAGREEMENT', 'ผู้ตรวจ']) expect(text).not.toContain(w);
  });

  it('does not show the grade while the result is pending_approval', () => {
    mock({
      ...base,
      status: 'pending_approval',
      latestResult: { version: 1, source: 'computed', status: 'pending_approval', grade, nRaters: 2, nExcluded: 0, methodVersion: 'v1', computedAt: '2026-10-05T00:00:00Z' },
    });
    render(<MyAssessmentDetail id="a1" />);
    expect(screen.getByTestId('myassess-status')).toHaveTextContent('อยู่ระหว่างตรวจ');
    expect(screen.queryByTestId('myassess-grade')).toBeNull();
    expect(screen.getByTestId('myassess-pending')).toBeInTheDocument();
  });

  it('shows pending wording when there is no published result', () => {
    mock({ ...base, status: 'in_review', latestResult: null, clips: [] });
    render(<MyAssessmentDetail id="a1" />);
    expect(screen.getByTestId('myassess-status')).toHaveTextContent('อยู่ระหว่างตรวจ');
    expect(screen.getByTestId('myassess-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('myassess-grade')).toBeNull();
    expect(screen.getByTestId('myassess-noclips')).toBeInTheDocument();
  });

  it('shows not-found and error states', () => {
    mock(undefined, { error: { status: 404 } });
    const { unmount } = render(<MyAssessmentDetail id="a1" />);
    expect(screen.getByTestId('myassess-error')).toHaveTextContent('ไม่พบคำขอประเมินนี้');
    unmount();
    mock(undefined, { error: new Error('x') });
    render(<MyAssessmentDetail id="a1" />);
    expect(screen.getByText('ลองใหม่')).toBeInTheDocument();
  });

  it('shows loading', () => {
    mock(undefined, { isLoading: true });
    render(<MyAssessmentDetail id="a1" />);
    expect(screen.getByTestId('myassess-loading')).toBeInTheDocument();
  });
});
