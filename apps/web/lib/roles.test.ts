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
  it('umpire gets only the umpire area', () => {
    expect(canAccess(['Umpire'], 'umpire')).toBe(true);
    expect(canAccess(['Umpire'], 'committee')).toBe(false);
    expect(homePathFor(['Umpire'])).toBe('/umpire');
  });
  it('home path follows highest role', () => {
    expect(homePathFor(['Member', 'Reviewer'])).toBe('/review');
    expect(homePathFor(['Member'])).toBe('/me');
    expect(homePathFor([])).toBe('/');
  });
});
