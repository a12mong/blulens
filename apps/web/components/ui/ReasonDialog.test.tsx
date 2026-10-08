import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReasonDialog } from './ReasonDialog';

describe('ReasonDialog', () => {
  it('submit stays disabled until the reason reaches minLength, then passes the trimmed text', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        minLength={20}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    const textarea = screen.getByTestId('reason-input') as HTMLTextAreaElement;
    const submitButton = screen.getByTestId('reason-submit') as HTMLButtonElement;
    const counter = screen.getByTestId('reason-count');

    // Initially disabled
    expect(submitButton).toBeDisabled();
    expect(counter).toHaveTextContent('0/20');

    // Type exactly 19 chars
    fireEvent.change(textarea, { target: { value: '1234567890123456789' } });
    expect(textarea.value).toBe('1234567890123456789');
    expect(submitButton).toBeDisabled();
    expect(counter).toHaveTextContent('19/20');

    // Type one more char (exactly 20)
    fireEvent.change(textarea, { target: { value: '12345678901234567890' } });
    expect(textarea.value).toBe('12345678901234567890');
    expect(submitButton).not.toBeDisabled();
    expect(counter).toHaveTextContent('20/20');

    // Type with surrounding spaces, trim counts only content
    fireEvent.change(textarea, { target: { value: '   12345678901234567890   ' } });
    expect(textarea.value).toBe('   12345678901234567890   ');
    expect(submitButton).not.toBeDisabled();
    expect(counter).toHaveTextContent('20/20');

    // Click submit with trimmed reason
    fireEvent.click(submitButton);
    expect(onSubmit).toHaveBeenCalledWith('12345678901234567890');
  });

  it('closed renders nothing', () => {
    const { container } = render(
      <ReasonDialog
        open={false}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('Escape key calls onCancel', async () => {
    const onCancel = vi.fn();

    render(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />
    );

    const textarea = screen.getByTestId('reason-input');
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalled();
  });

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn();

    render(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByTestId('reason-cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('error text is shown', () => {
    render(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        error="เหตุผลไม่ถูกต้อง"
      />
    );

    const errorElement = screen.getByTestId('reason-error');
    expect(errorElement).toHaveTextContent('เหตุผลไม่ถูกต้อง');
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  it('pending disables submit button', async () => {
    const onSubmit = vi.fn();

    render(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        minLength={1}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={true}
      />
    );

    const textarea = screen.getByTestId('reason-input');
    const submitButton = screen.getByTestId('reason-submit') as HTMLButtonElement;

    // Type valid reason
    await userEvent.type(textarea, 'reason');
    expect(submitButton).toBeDisabled();
  });

  it('focuses textarea when opened', async () => {
    const { rerender } = render(
      <ReasonDialog
        open={false}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    rerender(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const textarea = screen.getByTestId('reason-input');
    expect(textarea).toHaveFocus();
  });

  it('counter updates with trimmed length', async () => {
    render(
      <ReasonDialog
        open={true}
        title="เหตุผล"
        confirmLabel="ยืนยัน"
        minLength={5}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const textarea = screen.getByTestId('reason-input');
    const counter = screen.getByTestId('reason-count');

    await userEvent.type(textarea, '   test   ');
    expect(counter).toHaveTextContent('4/5');
  });
});
