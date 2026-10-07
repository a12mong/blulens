import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntryTable } from './EntryTable';
import type { components } from '@/lib/api/schema';

type Entry = components['schemas']['Entry'];

const mockGrade = {
  score: 7.4,
  margin: 0.6,
  lower: 'S' as const,
  upper: 'S+' as const,
  center: 'S' as const,
  tier: 'Standard' as const,
  kind: 'exact' as const,
  label: 'S',
};

const createMockEntry = (overrides?: Partial<Entry>): Entry => ({
  id: '1',
  eventId: 'event-1',
  status: 'draft' as const,
  createdBy: 'user-1',
  name: 'Test Entry',
  players: [
    {
      userId: 'player-1',
      displayName: 'Player One',
      teamIds: ['team-1'],
      teamId: 'team-1',
      teamCount: 1,
      gradeConsent: true,
      grade: mockGrade,
    },
  ],
  forwardedAt: null,
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  seedScore: null,
  gradeVisibility: 'hidden' as const,
  warnings: [],
  ...overrides,
});

describe('EntryTable', () => {
  it('committee mode shows approve and reject only for pending_committee rows', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    const entries: Entry[] = [
      createMockEntry({ id: '1', status: 'draft' as const }),
      createMockEntry({ id: '2', status: 'pending_committee' as const }),
      createMockEntry({ id: '3', status: 'approved' as const }),
    ];

    render(<EntryTable entries={entries} mode="committee" onApprove={onApprove} onReject={onReject} />);

    const approveButtons = screen.getAllByTestId('entry-approve');
    const rejectButtons = screen.getAllByTestId('entry-reject');

    expect(approveButtons).toHaveLength(1);
    expect(rejectButtons).toHaveLength(1);

    const approveButton = approveButtons[0];
    await userEvent.click(approveButton);

    expect(onApprove).toHaveBeenCalledWith(entries[1]);
  });

  it('admin mode shows edit+forward on draft, edit only on rejected', () => {
    const onEdit = vi.fn();
    const onForward = vi.fn();

    const entries: Entry[] = [
      createMockEntry({ id: '1', status: 'draft' as const }),
      createMockEntry({ id: '2', status: 'rejected' as const, decisionReason: 'ไม่ตรงกติกา' }),
      createMockEntry({ id: '3', status: 'approved' as const }),
    ];

    render(<EntryTable entries={entries} mode="admin" onEdit={onEdit} onForward={onForward} />);

    const rows = screen.getAllByTestId('entry-row');
    expect(rows).toHaveLength(3);

    // Draft: edit + forward
    const draftRow = rows[0];
    const draftEdit = within(draftRow).getByTestId('entry-edit');
    const draftForward = within(draftRow).getByTestId('entry-forward');
    expect(draftEdit).toBeInTheDocument();
    expect(draftForward).toBeInTheDocument();

    // Rejected: edit only
    const rejectedRow = rows[1];
    const rejectedEdit = within(rejectedRow).getByTestId('entry-edit');
    expect(rejectedEdit).toBeInTheDocument();
    expect(within(rejectedRow).queryByTestId('entry-forward')).toBeNull();

    // Approved: no buttons
    const approvedRow = rows[2];
    expect(within(approvedRow).queryByTestId('entry-edit')).toBeNull();
    expect(within(approvedRow).queryByTestId('entry-forward')).toBeNull();
  });

  it('displays decision reason when status is rejected', () => {
    const entries: Entry[] = [createMockEntry({ id: '1', status: 'rejected' as const, decisionReason: 'ไม่เป็นสมาชิกลุ่ม' })];

    render(<EntryTable entries={entries} mode="admin" />);

    const reasonElement = screen.getByTestId('entry-reason');
    expect(reasonElement).toHaveTextContent('ไม่เป็นสมาชิกลุ่ม');
  });

  it('shows hidden grade text when grade is null', () => {
    const entries: Entry[] = [
      createMockEntry({
        id: '1',
        players: [
          {
            userId: 'player-1',
            displayName: 'Player One',
            teamIds: [],
            teamId: null,
            teamCount: 0,
            gradeConsent: false,
            grade: null,
          },
        ],
      }),
    ];

    render(<EntryTable entries={entries} mode="admin" />);

    const hiddenGradeElements = screen.getAllByTestId('entry-grade-hidden');
    expect(hiddenGradeElements[0]).toHaveTextContent('ซ่อนอยู่');
  });

  it('displays warning chips with Thai labels', () => {
    const entries: Entry[] = [
      createMockEntry({
        id: '1',
        warnings: ['MULTI_TEAM', 'NO_APPROVED_GRADE', 'GRADE_OUT_OF_BAND'],
      }),
    ];

    render(<EntryTable entries={entries} mode="admin" />);

    const warningsList = screen.getByTestId('entry-warnings');
    expect(warningsList).toHaveTextContent('หลากลุ่ม');
    expect(warningsList).toHaveTextContent('ยังไม่มีเกรดอนุมัติ');
    expect(warningsList).toHaveTextContent('เกรดนอกช่วง');
  });

  it('renders empty state when no entries', () => {
    render(<EntryTable entries={[]} mode="admin" />);

    const emptyElement = screen.getByTestId('entry-empty');
    expect(emptyElement).toHaveTextContent('ยังไม่มีรายการ');
  });

  it('displays entry pair name and player info', () => {
    const entries: Entry[] = [
      createMockEntry({
        id: '1',
        name: 'Mixed Doubles A',
        players: [
          {
            userId: 'p1',
            displayName: 'Alice',
            teamIds: ['t1', 't2'],
            teamId: 't1',
            teamCount: 2,
            gradeConsent: true,
            grade: mockGrade,
          },
          {
            userId: 'p2',
            displayName: 'Bob',
            teamIds: ['t1'],
            teamId: 't1',
            teamCount: 1,
            gradeConsent: true,
            grade: mockGrade,
          },
        ],
      }),
    ];

    render(<EntryTable entries={entries} mode="admin" />);

    expect(screen.getByText('Mixed Doubles A')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument(); // Alice's teamCount
  });

  it('displays status badge with Thai text', () => {
    const entries: Entry[] = [
      createMockEntry({ id: '1', status: 'draft' as const }),
      createMockEntry({ id: '2', status: 'pending_committee' as const }),
      createMockEntry({ id: '3', status: 'approved' as const }),
      createMockEntry({ id: '4', status: 'rejected' as const }),
    ];

    render(<EntryTable entries={entries} mode="admin" />);

    expect(screen.getByText('ร่าง')).toBeInTheDocument();
    expect(screen.getByText('รอคณะกรรมการ')).toBeInTheDocument();
    expect(screen.getByText('อนุมัติแล้ว')).toBeInTheDocument();
    expect(screen.getByText('ถูกปฏิเสธ')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const entry = createMockEntry({ id: '1', status: 'draft' as const });

    render(<EntryTable entries={[entry]} mode="admin" onEdit={onEdit} />);

    const editButton = screen.getByTestId('entry-edit');
    await userEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(entry);
  });

  it('calls onForward when forward button is clicked', async () => {
    const onForward = vi.fn();
    const entry = createMockEntry({ id: '1', status: 'draft' as const });

    render(<EntryTable entries={[entry]} mode="admin" onForward={onForward} />);

    const forwardButton = screen.getByTestId('entry-forward');
    await userEvent.click(forwardButton);

    expect(onForward).toHaveBeenCalledWith(entry);
  });

  it('calls onReject when reject button is clicked', async () => {
    const onReject = vi.fn();
    const entry = createMockEntry({ id: '1', status: 'pending_committee' as const });

    render(<EntryTable entries={[entry]} mode="committee" onReject={onReject} />);

    const rejectButton = screen.getByTestId('entry-reject');
    await userEvent.click(rejectButton);

    expect(onReject).toHaveBeenCalledWith(entry);
  });

  it('sets data attributes on entry rows for entry id and status', () => {
    const entries: Entry[] = [createMockEntry({ id: 'uuid-123', status: 'draft' as const })];

    render(<EntryTable entries={entries} mode="admin" />);

    const row = screen.getByTestId('entry-row');
    expect(row).toHaveAttribute('data-entry-id', 'uuid-123');
    expect(row).toHaveAttribute('data-status', 'draft');
  });
});
