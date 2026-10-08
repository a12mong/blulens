'use client';

import React from 'react';
import type { Game } from './scoreRules';

export type GameScoreStepperProps = {
  index: number;
  value: Game;
  onChange: (g: Game) => void;
  error?: string | null;
  disabled?: boolean;
};

export function GameScoreStepper({
  index,
  value,
  onChange,
  error,
  disabled = false,
}: GameScoreStepperProps) {
  const handleScoreAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const digits = e.target.value.replace(/\D/g, '');
    if (digits === '') {
      onChange({ ...value, a: 0 });
      return;
    }
    const num = parseInt(digits, 10);
    if (!isNaN(num)) {
      onChange({ ...value, a: Math.min(99, Math.max(0, num)) });
    }
  };

  const handleScoreBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const digits = e.target.value.replace(/\D/g, '');
    if (digits === '') {
      onChange({ ...value, b: 0 });
      return;
    }
    const num = parseInt(digits, 10);
    if (!isNaN(num)) {
      onChange({ ...value, b: Math.min(99, Math.max(0, num)) });
    }
  };

  const handleMinusA = () => {
    if (disabled) return;
    onChange({ ...value, a: Math.max(0, value.a - 1) });
  };

  const handlePlusA = () => {
    if (disabled) return;
    onChange({ ...value, a: Math.min(99, value.a + 1) });
  };

  const handleMinusB = () => {
    if (disabled) return;
    onChange({ ...value, b: Math.max(0, value.b - 1) });
  };

  const handlePlusB = () => {
    if (disabled) return;
    onChange({ ...value, b: Math.min(99, value.b + 1) });
  };

  return (
    <fieldset
      data-testid="game-stepper"
      className="p-4 rounded-xl border border-border bg-card text-card-foreground"
    >
      <legend className="px-2 text-sm font-semibold text-foreground">
        เกมที่ {index + 1}
      </legend>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 sm:gap-6">
        {/* Column A */}
        <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-muted-foreground">ฝ่าย A</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="step-a-minus"
              aria-label="ลดแต้ม ฝ่าย A"
              disabled={disabled}
              onClick={handleMinusA}
              className="min-w-[56px] min-h-[56px] w-14 h-14 flex items-center justify-center text-2xl font-bold rounded-lg border border-border bg-muted text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              data-testid="score-a"
              aria-label="คะแนน ฝ่าย A"
              value={value.a}
              onChange={handleScoreAChange}
              disabled={disabled}
              className="min-h-[56px] w-16 text-center text-2xl font-bold rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              data-testid="step-a-plus"
              aria-label="เพิ่มแต้ม ฝ่าย A"
              disabled={disabled}
              onClick={handlePlusA}
              className="min-w-[56px] min-h-[56px] w-14 h-14 flex items-center justify-center text-2xl font-bold rounded-lg border border-border bg-muted text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        {/* Separator / vs */}
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">
          VS
        </div>

        {/* Column B */}
        <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-muted-foreground">ฝ่าย B</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="step-b-minus"
              aria-label="ลดแต้ม ฝ่าย B"
              disabled={disabled}
              onClick={handleMinusB}
              className="min-w-[56px] min-h-[56px] w-14 h-14 flex items-center justify-center text-2xl font-bold rounded-lg border border-border bg-muted text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              data-testid="score-b"
              aria-label="คะแนน ฝ่าย B"
              value={value.b}
              onChange={handleScoreBChange}
              disabled={disabled}
              className="min-h-[56px] w-16 text-center text-2xl font-bold rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              data-testid="step-b-plus"
              aria-label="เพิ่มแต้ม ฝ่าย B"
              disabled={disabled}
              onClick={handlePlusB}
              className="min-w-[56px] min-h-[56px] w-14 h-14 flex items-center justify-center text-2xl font-bold rounded-lg border border-border bg-muted text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="game-error"
          className="text-xs text-destructive mt-3 text-center"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export default GameScoreStepper;
