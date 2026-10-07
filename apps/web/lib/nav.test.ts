import { navFor } from './nav';

describe('navFor', () => {
  it('guest sees only public links', () => {
    expect(navFor([]).map((i) => i.href)).toEqual(['/', '/events']);
  });
  it('multi-role user gets one entry per accessible area', () => {
    const hrefs = navFor(['Member', 'Reviewer']).map((i) => i.href);
    expect(hrefs).toEqual(['/', '/events', '/me', '/review']);
  });
  it('admin alone does not get committee', () => {
    expect(navFor(['Admin']).map((i) => i.href)).not.toContain('/committee');
  });
});
