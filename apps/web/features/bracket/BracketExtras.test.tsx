import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Bracket } from './Bracket';
import { bracketFixture } from './bracketFixture';

const data = {
  eventId: 'e1',
  provisional: false,
  size: 8,
  rounds: [],
  champion: { entryId: 'c1', displayName: 'ทีมแชมป์' },
  thirdPlace: {
    matchNo: 8,
    round: 3,
    status: 'confirmed',
    winner: 'x1',
    topEntry: { entryId: 'x1', displayName: 'ที่สาม' },
    bottomEntry: { entryId: 'x2', displayName: 'ที่สี่' },
    top: 'x1',
    bottom: 'x2',
    games: [{ a: 21, b: 15 }],
  },
};

vi.mock('./api', () => ({
  useBracket: () => ({ data }),
  useEventMatches: () => ({ data: [] }),
}));
vi.mock('@tanstack/react-query', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({}),
}));

describe('Bracket extras', () => {
  it('shows the champion and the third-place match from the bracket read model', () => {
    render(<Bracket rounds={bracketFixture} eventId="e1" />);
    expect(screen.getByTestId('bracket-champion')).toHaveTextContent('ทีมแชมป์');
    const third = screen.getByTestId('bracket-third-place');
    expect(third).toHaveTextContent('ชิงที่ 3');
    expect(third).toHaveTextContent('ที่สาม');
    expect(third).toHaveTextContent('21–15');
  });
});
