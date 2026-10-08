import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GameScoreStepper } from './GameScoreStepper';
import type { Game } from './scoreRules';

describe('GameScoreStepper', () => {
  it('plus/minus and typing update the score, minus stops at 0 (proving test)', () => {
    // Controlled wrapper to test real state updates on multiple clicks
    function Wrapper() {
      const [score, setScore] = useState<Game>({ a: 0, b: 0 });
      return (
        <GameScoreStepper
          index={0}
          value={score}
          onChange={setScore}
          error="ยังไม่ครบ 21 แต้ม"
        />
      );
    }

    render(<Wrapper />);

    // Legend
    expect(screen.getByText('เกมที่ 1')).toBeInTheDocument();

    // click step-a-plus twice -> a: 2, b: 0
    const plusA = screen.getByTestId('step-a-plus');
    fireEvent.click(plusA);
    fireEvent.click(plusA);
    expect(screen.getByTestId('score-a')).toHaveValue('2');
    expect(screen.getByTestId('score-b')).toHaveValue('0');

    // step-b-minus at 0 -> stays 0
    const minusB = screen.getByTestId('step-b-minus');
    fireEvent.click(minusB);
    expect(screen.getByTestId('score-b')).toHaveValue('0');

    // typing '21' in score-a -> a 21
    const scoreAInput = screen.getByTestId('score-a');
    fireEvent.change(scoreAInput, { target: { value: '21' } });
    expect(screen.getByTestId('score-a')).toHaveValue('21');

    // error shows in game-error
    const errorEl = screen.getByTestId('game-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('ยังไม่ครบ 21 แต้ม');
  });

  it('calls onChange with correct values on direct prop testing', () => {
    const onChange = vi.fn();
    render(
      <GameScoreStepper
        index={2}
        value={{ a: 5, b: 3 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('เกมที่ 3')).toBeInTheDocument();

    // step-a-minus on 5 -> 4
    fireEvent.click(screen.getByTestId('step-a-minus'));
    expect(onChange).toHaveBeenCalledWith({ a: 4, b: 3 });

    // step-b-plus on 3 -> 4
    fireEvent.click(screen.getByTestId('step-b-plus'));
    expect(onChange).toHaveBeenCalledWith({ a: 5, b: 4 });

    // typing '15' in score-b -> b 15
    fireEvent.change(screen.getByTestId('score-b'), {
      target: { value: '15' },
    });
    expect(onChange).toHaveBeenCalledWith({ a: 5, b: 15 });
  });

  it('ignores non-numeric characters when typing', () => {
    const onChange = vi.fn();
    render(
      <GameScoreStepper
        index={0}
        value={{ a: 10, b: 10 }}
        onChange={onChange}
      />,
    );

    // Typing letters only
    fireEvent.change(screen.getByTestId('score-a'), {
      target: { value: 'abc' },
    });
    expect(onChange).toHaveBeenCalledWith({ a: 0, b: 10 });

    // Typing alphanumeric: filters non-digits
    fireEvent.change(screen.getByTestId('score-b'), {
      target: { value: '2a1' },
    });
    expect(onChange).toHaveBeenCalledWith({ a: 10, b: 21 });
  });

  it('disables all inputs and buttons when disabled is true', () => {
    const onChange = vi.fn();
    render(
      <GameScoreStepper
        index={0}
        value={{ a: 10, b: 5 }}
        onChange={onChange}
        disabled={true}
      />,
    );

    expect(screen.getByTestId('step-a-minus')).toBeDisabled();
    expect(screen.getByTestId('step-a-plus')).toBeDisabled();
    expect(screen.getByTestId('step-b-minus')).toBeDisabled();
    expect(screen.getByTestId('step-b-plus')).toBeDisabled();
    expect(screen.getByTestId('score-a')).toBeDisabled();
    expect(screen.getByTestId('score-b')).toBeDisabled();

    fireEvent.click(screen.getByTestId('step-a-plus'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not render error paragraph when error is undefined or null', () => {
    render(
      <GameScoreStepper
        index={0}
        value={{ a: 21, b: 19 }}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByTestId('game-error')).not.toBeInTheDocument();
  });
});
