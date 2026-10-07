import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTournamentWizard, validateStep } from './CreateTournamentWizard';

const mutate = vi.fn();
vi.mock('./wizardApi', async (orig) => ({
  ...(await orig<typeof import('./wizardApi')>()),
  useCreateTournamentWithEvents: () => ({ mutate, isPending: false }),
}));
vi.mock('./EventTypeCard', () => ({
  defaultEventType: () => ({
    discipline: 'XD', gradeMin: 'S-', gradeMax: 'S+', requiresFreshAssessment: false, minReviewers: 2, formatPreset: 'knockout',
  }),
  EventTypeCard: () => <div data-testid="etc-stub" />,
}));

const change = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });
const next = () => fireEvent.click(screen.getByTestId('wizard-next'));

describe('CreateTournamentWizard', () => {
  beforeEach(() => mutate.mockClear());

  it('walks 4 steps and submits the tournament with its events', () => {
    render(<CreateTournamentWizard />);
    change('tournament-name', 'Cup');
    next();
    change('tournament-starts-on', '2026-11-01');
    change('tournament-entries-close', '2026-10-25T10:00');
    next();
    expect(screen.getAllByTestId('event-type-card')).toHaveLength(1);
    next();
    expect(screen.getByTestId('wizard-summary')).toHaveTextContent('Cup');
    fireEvent.click(screen.getByTestId('wizard-create'));
    expect(mutate).toHaveBeenCalledOnce();
    const arg = mutate.mock.calls[0][0];
    expect(arg.tournament).toEqual({ name: 'Cup', startsOn: '2026-11-01', entriesCloseAt: new Date('2026-10-25T10:00').toISOString() });
    expect(arg.events[0]).toMatchObject({ discipline: 'XD', gradeMin: 'S-', gradeMax: 'S+', formatPreset: 'knockout', minReviewers: 2 });
  });

  it('blocks next on an empty name and shows the error', () => {
    render(<CreateTournamentWizard />);
    next();
    expect(screen.getByTestId('wizard-error')).toHaveTextContent('กรุณากรอกชื่อทัวร์นาเมนต์');
    expect(screen.getByTestId('tournament-name')).toBeInTheDocument();
  });

  it('validateStep: close after start is rejected', () => {
    const d = { name: 'x', venue: '', startsOn: '2026-11-01', entriesCloseAt: '2026-11-02T10:00', events: [] };
    expect(validateStep(1, d)).toBe('ปิดรับสมัครต้องก่อนหรือเท่าวันแข่ง');
    expect(validateStep(1, { ...d, entriesCloseAt: '2026-10-31T10:00' })).toBeNull();
  });

  it('add and remove event types', () => {
    render(<CreateTournamentWizard />);
    change('tournament-name', 'Cup');
    next();
    change('tournament-starts-on', '2026-11-01');
    change('tournament-entries-close', '2026-10-25T10:00');
    next();
    fireEvent.click(screen.getByTestId('wizard-add-event-type'));
    expect(screen.getAllByTestId('event-type-card')).toHaveLength(2);
  });
});
