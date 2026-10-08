import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MyResults } from './MyResults';
import { ApiRequestError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type Assessment = components['schemas']['Assessment'];

const mockUseAssessments = vi.fn();

vi.mock('@/features/assessments/api', () => ({
  useAssessments: () => mockUseAssessments(),
}));

const publishedAssessment: Assessment = {
  id: 'ass-1',
  subjectUserId: 'user-member-1',
  status: 'approved',
  createdAt: '2026-10-01T10:00:00.000Z',
  event: {
    id: 'ev-1',
    tournamentName: 'Bangkok Cup 2026',
    discipline: 'MS',
  },
  latestGrade: {
    label: 'S/S+',
    lower: 'S',
    upper: 'S+',
    center: 'S',
    kind: 'straddle',
    score: 7.2,
  },
};

const pendingAssessment: Assessment = {
  id: 'ass-2',
  subjectUserId: 'user-member-1',
  status: 'in_review',
  createdAt: '2026-10-02T11:00:00.000Z',
  event: {
    id: 'ev-2',
    tournamentName: 'Chiang Mai Open 2026',
    discipline: 'WD',
  },
  latestGrade: null,
};

const generalAssessment: Assessment = {
  id: 'ass-3',
  subjectUserId: 'user-member-1',
  status: 'submitted',
  createdAt: '2026-10-03T12:00:00.000Z',
  event: null,
  latestGrade: null,
};

const withdrawnAssessment: Assessment = {
  id: 'ass-4',
  subjectUserId: 'user-member-1',
  status: 'withdrawn',
  createdAt: '2026-10-04T13:00:00.000Z',
  event: {
    id: 'ev-3',
    tournamentName: 'Phuket Open 2026',
    discipline: 'XD',
  },
  latestGrade: null,
};

describe('MyResults', () => {
  let refetchMock: ReturnType<typeof vi.fn>;
  let fetchNextPageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    refetchMock = vi.fn();
    fetchNextPageMock = vi.fn();
  });

  it('proves: shows the grade only when it is published and never leaks reviewer details', () => {
    mockUseAssessments.mockReturnValue({
      data: {
        items: [publishedAssessment, pendingAssessment],
        nextCursor: null,
      },
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<MyResults />);

    const cards = screen.getAllByTestId('myresult-card');
    expect(cards).toHaveLength(2);

    const statuses = screen.getAllByTestId('myresult-status');
    expect(statuses[0]).toHaveTextContent('ผลประกาศแล้ว');
    expect(statuses[1]).toHaveTextContent('อยู่ระหว่างตรวจ');

    // First card shows grade band and grade text
    expect(screen.getByText(/Bangkok Cup 2026 · ชายเดี่ยว/)).toBeInTheDocument();
    expect(screen.getByText('ระดับ S/S+ · ช่วง S–S+')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /เกรด S ถึง S\+ คะแนน 7\.2/ })).toBeInTheDocument();

    // First card timeline marks 'ผลประกาศ (ตอนนี้)'
    const timelines = screen.getAllByTestId('myresult-timeline');
    expect(timelines[0]).toHaveTextContent('ผลประกาศ (ตอนนี้)');

    // Second card does not show GradeBand or grade text, and timeline marks 'กำลังตรวจ (ตอนนี้)'
    expect(screen.getByText(/Chiang Mai Open 2026 · หญิงคู่/)).toBeInTheDocument();
    expect(within(cards[1]).queryByText(/ระดับ/)).not.toBeInTheDocument();
    expect(within(cards[1]).queryByRole('img')).not.toBeInTheDocument();
    expect(timelines[1]).toHaveTextContent('กำลังตรวจ (ตอนนี้)');

    // Blind review guarantees: never leak reviewer details, provisional/disputed flags, or review counts
    expect(screen.queryByText(/provisional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/disputed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ผู้ตรวจ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/รีวิว/)).not.toBeInTheDocument();
    expect(screen.queryByText(/กรรมการ \d/)).not.toBeInTheDocument();
  });

  it('renders "ประเมินทั่วไป" when event is null', () => {
    mockUseAssessments.mockReturnValue({
      data: {
        items: [generalAssessment],
        nextCursor: null,
      },
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<MyResults />);

    expect(screen.getByText('ประเมินทั่วไป')).toBeInTheDocument();
  });

  it('renders "ยกเลิก" status when assessment is withdrawn', () => {
    mockUseAssessments.mockReturnValue({
      data: {
        items: [withdrawnAssessment],
        nextCursor: null,
      },
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<MyResults />);

    expect(screen.getByTestId('myresult-status')).toHaveTextContent('ยกเลิก');
  });

  it('renders empty state with link to /events when no assessments exist', () => {
    mockUseAssessments.mockReturnValue({
      data: {
        items: [],
        nextCursor: null,
      },
      isPending: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<MyResults />);

    const emptyBox = screen.getByTestId('myresult-empty');
    expect(emptyBox).toBeInTheDocument();
    expect(screen.getByText('คุณยังไม่มีผลประเมิน')).toBeInTheDocument();

    const eventsLink = screen.getByRole('link', { name: 'ดูอีเวนต์' });
    expect(eventsLink).toHaveAttribute('href', '/events');
  });

  it('renders loading skeleton while fetching', () => {
    mockUseAssessments.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: refetchMock,
    });

    render(<MyResults />);

    expect(screen.getByTestId('myresult-loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state with retry button calling refetch', () => {
    const error = new ApiRequestError(500, 'SERVER_ERROR', 'Network error');
    mockUseAssessments.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error,
      refetch: refetchMock,
    });

    render(<MyResults />);

    const errorAlert = screen.getByTestId('myresult-error');
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders load more button when nextCursor exists and calls fetchNextPage on click', () => {
    mockUseAssessments.mockReturnValue({
      data: {
        items: [publishedAssessment],
        nextCursor: 'cursor-page-2',
      },
      isPending: false,
      isError: false,
      fetchNextPage: fetchNextPageMock,
      refetch: refetchMock,
    });

    render(<MyResults />);

    const loadMoreBtn = screen.getByTestId('myresult-load-more');
    expect(loadMoreBtn).toBeInTheDocument();
    expect(loadMoreBtn).toHaveTextContent('โหลดเพิ่ม');

    fireEvent.click(loadMoreBtn);
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
  });
});
