import { render, screen } from '@testing-library/react';
import { SideNav } from './SideNav';

describe('SideNav', () => {
  it('marks the current area and lists links for the held roles', () => {
    render(<SideNav roles={['Member', 'Committee']} pathname="/committee/queue" />);
    expect(screen.getByRole('link', { name: 'คณะกรรมการ' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ของฉัน' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'ผู้ดูแลระบบ' })).toBeNull();
  });
});
