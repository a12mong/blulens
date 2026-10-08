import { navFor, NAV_ITEMS } from './nav';
import { ROLE_LABELS } from './roles';

describe('navFor', () => {
  it('guest sees only public links', () => {
    expect(navFor([]).map((i) => i.href)).toEqual(['/', '/events']);
  });
  it('multi-role user gets one entry per accessible area', () => {
    const hrefs = navFor(['Member', 'Reviewer']).map((i) => i.href);
    expect(hrefs).toEqual(['/', '/events', '/me', '/review']);
  });
  it('admin alone does not get committee', () => {
    expect(navFor(['Admin']).map((i) => i.href)).not.toContain('/committee/assessments');
  });
  it('no menu label equals a role label', () => {
    const roleLabels = Object.values(ROLE_LABELS);
    for (const item of NAV_ITEMS) {
      expect(roleLabels).not.toContain(item.label);
    }
  });
});
