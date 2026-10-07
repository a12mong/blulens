import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GradePicker } from './GradePicker';
import type { GradeKey } from './GradeBand';

describe('GradePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tier tap then key tap emits the GradeKey', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="tiered" />
    );

    // Tap Standard tier to expand it
    const standardTierBtn = screen.getByTestId('gp-tier-Standard');
    fireEvent.click(standardTierBtn);

    // Tap S+ key
    const sPlusBtn = screen.getByTestId('gp-key-S+');
    fireEvent.click(sPlusBtn);

    expect(onChangeMock).toHaveBeenCalledWith('S+');
  });

  it('N/A button emits null when clicked', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} allowNA variant="tiered" />
    );

    const naBtn = screen.getByTestId('gp-na');
    fireEvent.click(naBtn);
    expect(onChangeMock).toHaveBeenCalledWith(null);
  });

  it('clear button emits undefined', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value="S" onChange={onChangeMock} allowNA variant="tiered" />
    );

    // Clear button should be visible when value is set
    const clearBtn = screen.getByTestId('gp-clear');
    fireEvent.click(clearBtn);

    expect(onChangeMock).toHaveBeenCalledWith(undefined);
  });

  it('ladder variant renders exactly 15 gp-key buttons', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="ladder" />
    );

    const keyButtons = screen.getAllByTestId(/^gp-key-/);
    expect(keyButtons).toHaveLength(15);
  });

  it('anchor text shown for the selected tier', () => {
    const onChangeMock = vi.fn();
    const anchors = {
      Standard: 'This is standard level performance',
      Professional: 'This is professional level',
    };

    render(
      <GradePicker
        value="S"
        onChange={onChangeMock}
        variant="tiered"
        anchorsByTier={anchors}
      />
    );

    const anchorText = screen.getByTestId('gp-anchor');
    expect(anchorText).toHaveTextContent('This is standard level performance');
  });

  it('selected key has aria-checked=true', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value="P+" onChange={onChangeMock} variant="ladder" />
    );

    const selectedBtn = screen.getByTestId('gp-key-P+');
    expect(selectedBtn).toHaveAttribute('aria-checked', 'true');

    const unselectedBtn = screen.getByTestId('gp-key-S');
    expect(unselectedBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('disabled blocks clicks', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} disabled variant="tiered" />
    );

    const tierBtn = screen.getByTestId('gp-tier-Standard');
    fireEvent.click(tierBtn);

    // Tier should not expand (no key buttons visible)
    expect(screen.queryByTestId('gp-key-S')).not.toBeInTheDocument();
    expect(onChangeMock).not.toHaveBeenCalled();
  });

  it('ArrowRight moves focus among visible radio buttons', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="ladder" />
    );

    const firstBtn = screen.getByTestId('gp-key-RK1');
    firstBtn.focus();

    fireEvent.keyDown(firstBtn, { key: 'ArrowRight' });

    const secondBtn = screen.getByTestId('gp-key-RK2');
    expect(document.activeElement).toBe(secondBtn);
  });

  it('tiered variant shows clear button only when value is defined', () => {
    const onChangeMock = vi.fn();

    const { rerender } = render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="tiered" />
    );

    expect(screen.queryByTestId('gp-clear')).not.toBeInTheDocument();

    rerender(
      <GradePicker value="P-" onChange={onChangeMock} variant="tiered" />
    );

    expect(screen.getByTestId('gp-clear')).toBeInTheDocument();
  });

  it('allowNA=false does not render N/A button', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} allowNA={false} />
    );

    expect(screen.queryByTestId('gp-na')).not.toBeInTheDocument();
  });

  it('ladder variant shows tier names above key groups', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="ladder" />
    );

    expect(screen.getByText('มือใหม่')).toBeInTheDocument();
    expect(screen.getByText('เริ่มต้น')).toBeInTheDocument();
    expect(screen.getByText('มาตรฐาน')).toBeInTheDocument();
    expect(screen.getByText('กลาง')).toBeInTheDocument();
    expect(screen.getByText('มืออาชีพ')).toBeInTheDocument();
  });

  it('Space or Enter selects the focused radio', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="ladder" />
    );

    const btn = screen.getByTestId('gp-key-N');
    btn.focus();

    fireEvent.keyDown(btn, { key: ' ' });
    expect(onChangeMock).toHaveBeenCalledWith('N');

    onChangeMock.mockClear();
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onChangeMock).toHaveBeenCalledWith('N');
  });

  it('tiered variant expands tier on click and collapses on second click', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker value={undefined} onChange={onChangeMock} variant="tiered" />
    );

    const tierBtn = screen.getByTestId('gp-tier-Rookie');
    fireEvent.click(tierBtn);

    // Keys should be visible
    expect(screen.getByTestId('gp-key-RK1')).toBeInTheDocument();

    // Click tier again to collapse
    fireEvent.click(tierBtn);

    // Keys should no longer be visible
    expect(screen.queryByTestId('gp-key-RK1')).not.toBeInTheDocument();
  });

  it('selected NA button shows checkmark and can be toggled off', () => {
    const onChangeMock = vi.fn();

    const { rerender } = render(
      <GradePicker value={null} onChange={onChangeMock} allowNA variant="tiered" />
    );

    const naBtn = screen.getByTestId('gp-na');
    expect(naBtn).toHaveAttribute('aria-checked', 'true');
    expect(naBtn.textContent).toContain('✓');

    fireEvent.click(naBtn);
    expect(onChangeMock).toHaveBeenCalledWith(undefined);
  });

  it('aria-label can be customized', () => {
    const onChangeMock = vi.fn();

    render(
      <GradePicker
        value={undefined}
        onChange={onChangeMock}
        aria-label="Custom grade selection"
      />
    );

    const radioGroup = screen.getByTestId('grade-picker');
    expect(radioGroup).toHaveAttribute('aria-label', 'Custom grade selection');
  });
});
