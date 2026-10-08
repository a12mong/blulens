import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders nav, user name, role, logout and content in account block apart from menu', () => {
    const onLogout = vi.fn();
    render(
      <AppShell roles={['Member']} displayName="สมชาย" pathname="/me" onLogout={onLogout}>
        <p>เนื้อหา</p>
      </AppShell>,
    );
    expect(screen.getByText('เนื้อหา')).toBeInTheDocument();
    expect(screen.getByText('สมชาย')).toBeInTheDocument();
    expect(screen.getByText('สมาชิก')).toBeInTheDocument();

    const accountBlock = screen.getByTestId('account-block');
    expect(accountBlock).toBeInTheDocument();

    const logoutBtn = screen.getByRole('button', { name: 'ออกจากระบบ' });
    expect(logoutBtn).toHaveClass('min-h-11');
    logoutBtn.click();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('drawer toggles aria-expanded and closes on route change', () => {
    const { rerender } = render(
      <AppShell roles={['Member']} pathname="/me">
        <p>เนื้อหา</p>
      </AppShell>,
    );

    const toggleBtn = screen.getByTestId('drawer-toggle');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveClass('min-h-11', 'min-w-11');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Closes on route change
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <AppShell roles={['Member']} pathname="/events">
        <p>เนื้อหา</p>
      </AppShell>,
    );
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
