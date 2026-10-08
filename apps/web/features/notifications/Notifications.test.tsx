import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { NotificationBell, formatBadge } from './NotificationBell';
import { NotificationsPage } from './NotificationsPage';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  useUnreadCount: vi.fn(),
  useNotifications: vi.fn(),
  useMarkRead: vi.fn(),
  useMarkAllRead: vi.fn(),
}));

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);

const item = (id: string, readAt: string | null, link: string | null = '/me/assessments/a1') => ({
  id,
  type: 'assessment_approved',
  title: 'ผลประเมินได้รับอนุมัติ ' + id,
  body: null,
  link,
  readAt,
  createdAt: '2026-10-08T10:00:00Z',
});

function mockList(items: unknown[], unreadCount: number, extra: Record<string, unknown> = {}) {
  vi.mocked(api.useNotifications).mockReturnValue({
    data: { pages: [{ items, nextCursor: null, unreadCount }] },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...extra,
  } as never);
}

describe('NotificationBell', () => {
  it('shows the unread count, capped at 9+', () => {
    expect(formatBadge(3)).toBe('3');
    expect(formatBadge(12)).toBe('9+');
    vi.mocked(api.useUnreadCount).mockReturnValue({ data: 12 } as never);
    render(wrap(<NotificationBell pathname="/me" />));
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('9+');
    expect(screen.getByTestId('notification-bell')).toHaveAttribute('href', '/notifications');
  });

  it('hides the badge at zero', () => {
    vi.mocked(api.useUnreadCount).mockReturnValue({ data: 0 } as never);
    render(wrap(<NotificationBell pathname="/me" />));
    expect(screen.queryByTestId('notification-badge')).toBeNull();
  });
});

describe('NotificationsPage', () => {
  const markRead = vi.fn();
  const markAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    markRead.mockResolvedValue(undefined);
    vi.mocked(api.useMarkRead).mockReturnValue({ mutateAsync: markRead, isPending: false } as never);
    vi.mocked(api.useMarkAllRead).mockReturnValue({ mutate: markAll, isPending: false } as never);
  });

  it('marks an unread item read and opens its link; read-all calls the mutation', async () => {
    mockList([item('n1', null), item('n2', '2026-10-08T11:00:00Z')], 1);
    render(<NotificationsPage />);
    const rows = screen.getAllByTestId('notif-item');
    expect(rows[0]).toHaveAttribute('data-unread', 'true');
    expect(rows[1]).toHaveAttribute('data-unread', 'false');

    fireEvent.click(rows[0]);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/me/assessments/a1'));
    expect(markRead).toHaveBeenCalledWith('n1');

    fireEvent.click(rows[1]);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(2));
    expect(markRead).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('notif-read-all'));
    expect(markAll).toHaveBeenCalled();
  });

  it('ignores external links, shows empty and error states', () => {
    mockList([item('n3', null, 'https://evil.example/x')], 1);
    const { unmount } = render(<NotificationsPage />);
    fireEvent.click(screen.getByTestId('notif-item'));
    expect(push).not.toHaveBeenCalled();
    unmount();

    mockList([], 0);
    const second = render(<NotificationsPage />);
    expect(screen.getByTestId('notif-empty')).toBeInTheDocument();
    expect(screen.getByTestId('notif-read-all')).toBeDisabled();
    second.unmount();

    mockList([], 0, { data: undefined, error: new Error('x') });
    render(<NotificationsPage />);
    expect(screen.getByTestId('notif-error')).toBeInTheDocument();
  });
});
