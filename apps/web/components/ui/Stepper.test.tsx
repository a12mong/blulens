import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

describe('Stepper', () => {
  const steps = ['พื้นฐาน', 'วันที่', 'ประเภทและกติกา', 'ทบทวน'];

  it('only completed steps are clickable and current has aria-current', () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={steps} current={2} onStepClick={onStepClick} />);

    const stepElements = screen.getAllByTestId('stepper-step');
    expect(stepElements).toHaveLength(4);

    // Step 0: completed, button, data-state="done"
    expect(stepElements[0]).toHaveAttribute('data-state', 'done');
    const button0 = within(stepElements[0]).getByRole('button');
    expect(button0).toBeInTheDocument();
    fireEvent.click(button0);
    expect(onStepClick).toHaveBeenCalledWith(0);

    // Step 1: completed, button, data-state="done"
    expect(stepElements[1]).toHaveAttribute('data-state', 'done');
    const button1 = within(stepElements[1]).getByRole('button');
    expect(button1).toBeInTheDocument();

    // Step 2: current, aria-current="step", not a button, data-state="current"
    expect(stepElements[2]).toHaveAttribute('data-state', 'current');
    expect(stepElements[2]).toHaveAttribute('aria-current', 'step');
    expect(within(stepElements[2]).queryByRole('button')).toBeNull();

    // Step 3: todo, not a button, data-state="todo"
    expect(stepElements[3]).toHaveAttribute('data-state', 'todo');
    expect(stepElements[3]).not.toHaveAttribute('aria-current');
    expect(within(stepElements[3]).queryByRole('button')).toBeNull();
  });

  it('clicking another completed step calls onStepClick with its index', () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={steps} current={3} onStepClick={onStepClick} />);

    const stepElements = screen.getAllByTestId('stepper-step');
    const button1 = within(stepElements[1]).getByRole('button');
    fireEvent.click(button1);
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it('does not throw when clicking a completed step without onStepClick prop', () => {
    render(<Stepper steps={steps} current={2} />);

    const stepElements = screen.getAllByTestId('stepper-step');
    const button0 = within(stepElements[0]).getByRole('button');
    expect(() => fireEvent.click(button0)).not.toThrow();
  });

  it('renders no buttons when current is 0', () => {
    render(<Stepper steps={steps} current={0} />);

    expect(screen.queryByRole('button')).toBeNull();
    const stepElements = screen.getAllByTestId('stepper-step');
    expect(stepElements[0]).toHaveAttribute('data-state', 'current');
    expect(stepElements[0]).toHaveAttribute('aria-current', 'step');
    expect(stepElements[1]).toHaveAttribute('data-state', 'todo');
    expect(stepElements[2]).toHaveAttribute('data-state', 'todo');
    expect(stepElements[3]).toHaveAttribute('data-state', 'todo');
  });

  it('renders all steps as buttons when all are completed (current >= steps.length)', () => {
    render(<Stepper steps={steps} current={4} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    const stepElements = screen.getAllByTestId('stepper-step');
    stepElements.forEach((el) => {
      expect(el).toHaveAttribute('data-state', 'done');
    });
  });

  it('displays number, label, and accessible list structure', () => {
    render(<Stepper steps={steps} current={1} />);

    const stepper = screen.getByTestId('stepper');
    expect(stepper.tagName.toLowerCase()).toBe('ol');
    expect(stepper).toHaveAttribute('aria-label', 'ขั้นตอน');

    expect(screen.getByText(/1\. พื้นฐาน/)).toBeInTheDocument();
    expect(screen.getByText(/2\. วันที่/)).toBeInTheDocument();
    expect(screen.getByText(/3\. ประเภทและกติกา/)).toBeInTheDocument();
    expect(screen.getByText(/4\. ทบทวน/)).toBeInTheDocument();

    const markers = screen.getAllByTestId('step-marker');
    expect(markers[0]).toHaveTextContent('✓');
    expect(markers[1]).toHaveTextContent('2');
    expect(markers[2]).toHaveTextContent('3');
    expect(markers[3]).toHaveTextContent('4');
  });
});
