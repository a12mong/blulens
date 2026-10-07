import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders nav, user name, logout and content', () => {
    const onLogout = vi.fn();
    render(
      <AppShell roles={['Member']} displayName="สมชาย" pathname="/me" onLogout={onLogout}>
        <p>เนื้อหา</p>
      </AppShell>,
    );
    expect(screen.getByText('เนื้อหา')).toBeInTheDocument();
    expect(screen.getByText('สมชาย')).toBeInTheDocument();
    screen.getByRole('button', { name: 'ออกจากระบบ' }).click();
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
