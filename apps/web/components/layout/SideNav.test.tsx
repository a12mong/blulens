import { render, screen } from '@testing-library/react';
import { SideNav } from './SideNav';

describe('SideNav', () => {
  it('marks the current area and lists links for the held roles', () => {
    render(<SideNav roles={['Member', 'Committee']} pathname="/committee/assessments" />);
    expect(screen.getByRole('link', { name: 'ผลประเมิน' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ของฉัน' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'ผู้ดูแลระบบ' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'คณะกรรมการ' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'จัดการผู้ใช้' })).toBeNull();
  });

  it('renders menu-skeleton and no links when isLoading is true', () => {
    render(<SideNav roles={['Member', 'Committee']} pathname="/committee/assessments" isLoading={true} />);
    expect(screen.getByTestId('menu-skeleton')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
