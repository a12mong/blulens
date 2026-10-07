import { canAccess, homePathFor } from './roles';

describe('roles', () => {
  it('admin alone cannot enter committee; admin+committee can', () => {
    expect(canAccess(['Admin'], 'committee')).toBe(false);
    expect(canAccess(['Admin', 'Committee'], 'committee')).toBe(true);
  });
  it('guest (no roles) only gets public', () => {
    expect(canAccess([], 'public')).toBe(true);
    expect(canAccess([], 'member')).toBe(false);
  });
  it('home path follows highest role', () => {
    expect(homePathFor(['Member', 'Reviewer'])).toBe('/review');
    expect(homePathFor(['Member'])).toBe('/me');
    expect(homePathFor([])).toBe('/');
  });
});
