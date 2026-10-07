import { fireEvent, render, screen } from '@testing-library/react';
import { LoginForm, safeNext } from './LoginForm';

const replace = vi.fn();
const mutate = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('next=/committee'),
}));
vi.mock('./api', () => ({ useLogin: () => ({ mutate, error: null, isPending: false }) }));

describe('LoginForm', () => {
  it('submits identifier and password', () => {
    render(<LoginForm />);
    expect(screen.getByTestId('login-identifier')).toBeInTheDocument();
    expect(screen.getByTestId('login-password')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/อีเมลหรือชื่อผู้ใช้/), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText(/รหัสผ่าน/), { target: { value: 'secret-pass-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(mutate).toHaveBeenCalledWith({ identifier: 'a@b.c', password: 'secret-pass-1' });
  });
  it('safeNext blocks open redirects', () => {
    expect(safeNext('/committee')).toBe('/committee');
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
