import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentDetailView } from './AssessmentDetailView';
import { useAssessmentDetail, type AssessmentDetail } from './api';

vi.mock('./api', () => ({
  useAssessmentDetail: vi.fn(),
}));

// Mock ClipPlayer to simplify video testing
vi.mock('@/components/ui/ClipPlayer', () => ({
  ClipPlayer: ({ clips }: { clips: any[] }) => (
    <div data-testid="clip-player">ClipPlayer clips count: {clips.length}</div>
  ),
}));

describe('AssessmentDetailView', () => {
  const mockDetailData: AssessmentDetail = {
    id: 'asm-1',
    subjectUserId: 'user-1',
    status: 'pending_approval',
    subject: {
      userId: 'user-1',
      displayName: 'สมชาย ใจดี',
      clubNames: [],
    },
    latestResult: {
      version: 1,
      source: 'computed',
      status: 'pending',
      grade: {
        score: 7.5,
        margin: 0.5,
        lower: 'S',
        upper: 'S+',
        center: 'S',
        kind: 'exact',
        label: 'S/S+',
      },
      nRaters: 2,
      nExcluded: 1,
      spread: 1.5,
      flags: ['OUTLIER_EXCLUDED'],
      methodVersion: 'grading-v1',
      computedAt: '2026-10-07T12:00:00Z',
    },
    clips: [
      {
        id: 'c-1',
        status: 'uploaded',
        viewUrl: 'http://localhost/sample.mp4',
        durationSec: 45,
      },
    ],
    reviewerRows: [
      {
        reviewerId: 'r-1',
        reviewerName: 'กรรมการ ก',
        overall: 7.5,
        excluded: false,
        robustZ: null,
        reviewerBias: 0.2,
        pairKappa: null,
        criteria: [
          { criterion: 'footwork', gradeKey: 'S' },
          { criterion: 'technique', gradeKey: 'S+' },
        ],
      },
      {
        reviewerId: 'r-2',
        reviewerName: 'กรรมการ ข',
        overall: 9.5,
        excluded: true,
        robustZ: 3.9,
        reviewerBias: -0.4,
        pairKappa: 0.65,
        criteria: [
          { criterion: 'footwork', gradeKey: 'P' },
          { criterion: 'technique', gradeKey: null },
        ],
      },
    ],
    createdAt: '2026-10-07T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the result, flags and one row per reviewer with the excluded one marked', () => {
    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: mockDetailData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    // Header displays subject display name
    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();

    // detail-result shows 'S/S+'
    const resultBlock = screen.getByTestId('detail-result');
    expect(resultBlock).toHaveTextContent('S/S+');
    expect(resultBlock).toHaveTextContent('คะแนน 7.50 ± 0.50');
    expect(resultBlock).toHaveTextContent('ผู้ประเมินที่ใช้ 2 · ตัดออก 1');
    expect(resultBlock).toHaveTextContent('ส่วนต่าง 1.50');

    // detail-flags contains 'ค่าผิดปกติถูกตัดออก'
    const flagsBlock = screen.getByTestId('detail-flags');
    expect(flagsBlock).toHaveTextContent('ค่าผิดปกติถูกตัดออก');

    // 2 detail-reviewer-row, the second contains 'ตัดออก' and 'z=3.9'
    const rows = screen.getAllByTestId('detail-reviewer-row');
    expect(rows).toHaveLength(2);

    expect(rows[0]).toHaveTextContent('กรรมการ ก');
    expect(rows[0]).toHaveTextContent('7.50');
    expect(rows[0]).toHaveTextContent('ใช้');
    expect(rows[0]).toHaveTextContent('+0.2 ขั้น');

    expect(rows[1]).toHaveTextContent('กรรมการ ข');
    expect(rows[1]).toHaveTextContent('9.50');
    expect(rows[1]).toHaveTextContent('ตัดออก');
    expect(rows[1]).toHaveTextContent('z=3.9');
    expect(rows[1]).toHaveTextContent('-0.4 ขั้น');
    expect(rows[1]).toHaveTextContent('κ 0.65');
  });

  it('latestResult null shows "ยังสรุปไม่ได้" and no score numbers', () => {
    const dataWithoutResult: AssessmentDetail = {
      ...mockDetailData,
      latestResult: null,
    };

    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: dataWithoutResult,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    const resultBlock = screen.getByTestId('detail-result');
    expect(resultBlock).toHaveTextContent('ยังสรุปไม่ได้');
    expect(resultBlock).not.toHaveTextContent('คะแนน');
    expect(resultBlock).not.toHaveTextContent('±');
  });

  it('override result shows the reason', () => {
    const overrideData: AssessmentDetail = {
      ...mockDetailData,
      latestResult: {
        ...mockDetailData.latestResult!,
        source: 'override',
        reason: 'ผู้เล่นมีผลการแข่งระดับประเทศรองรับ คณะกรรมการจึงปรับเกรด',
        flags: ['OVERRIDE'],
      },
    };

    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: overrideData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    const flagsBlock = screen.getByTestId('detail-flags');
    expect(flagsBlock).toHaveTextContent('แก้ไขโดยคณะกรรมการ');
    expect(flagsBlock).toHaveTextContent(
      'เหตุผล: ผู้เล่นมีผลการแข่งระดับประเทศรองรับ คณะกรรมการจึงปรับเกรด',
    );
  });

  it('shows skeleton loading state when isLoading is true', () => {
    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    const loadingState = screen.getByTestId('detail-loading');
    expect(loadingState).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('detail-result')).toBeNull();
  });

  it('shows error state with retry button calling refetch when isError is true', () => {
    const refetch = vi.fn();
    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('เชื่อมต่อล้มเหลว'),
      refetch,
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveAttribute('data-testid', 'detail-error');
    expect(errorAlert).toHaveTextContent('เชื่อมต่อล้มเหลว');

    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows "ยังไม่มีคลิป" when clips array is empty', () => {
    const dataNoClips: AssessmentDetail = {
      ...mockDetailData,
      clips: [],
    };

    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: dataNoClips,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    expect(screen.getByText('ยังไม่มีคลิป')).toBeInTheDocument();
    expect(screen.queryByTestId('clip-player')).toBeNull();
  });

  it('renders back link to /committee/assessments', () => {
    vi.mocked(useAssessmentDetail).mockReturnValue({
      data: mockDetailData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AssessmentDetailView id="asm-1" />);

    const backLink = screen.getByRole('link', { name: '← รายการผลประเมิน' });
    expect(backLink).toHaveAttribute('href', '/committee/assessments');
  });
});
