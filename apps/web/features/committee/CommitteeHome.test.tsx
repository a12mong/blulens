import { render, screen } from '@testing-library/react';
import { CommitteeHome } from './CommitteeHome';
import { describe, it, expect } from 'vitest';

describe('CommitteeHome', () => {
  it('links every committee area', () => {
    render(<CommitteeHome />);

    const assessmentsLink = screen.getByTestId('committee-link-assessments');
    expect(assessmentsLink).toHaveAttribute('href', '/committee/assessments');
    expect(assessmentsLink).toHaveTextContent('ผลประเมิน');

    const teamLink = screen.getByTestId('committee-link-team-requests');
    expect(teamLink).toHaveAttribute('href', '/committee/teams/requests');
    expect(teamLink).toHaveTextContent('คำขอทีม');

    const eventsLink = screen.getByTestId('committee-link-events');
    expect(eventsLink).toHaveAttribute('href', '/events');
    expect(eventsLink).toHaveTextContent('อีเวนต์');
  });
});
