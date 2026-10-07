'use client';

import React from 'react';

export type StepperProps = {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
};

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <ol
      aria-label="ขั้นตอน"
      data-testid="stepper"
      className="flex w-full items-center justify-between gap-2 overflow-x-auto py-2"
    >
      {steps.map((step, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        const state: 'done' | 'current' | 'todo' = isDone
          ? 'done'
          : isCurrent
            ? 'current'
            : 'todo';

        const stepNumber = index + 1;
        const marker = isDone ? '✓' : `${stepNumber}`;

        return (
          <li
            key={index}
            data-testid="stepper-step"
            data-state={state}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex items-center gap-2 flex-1 last:flex-initial"
          >
            {isDone ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer group"
              >
                <span
                  data-testid="step-marker"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                >
                  {marker}
                </span>
                <span className="truncate group-hover:underline">
                  {stepNumber}. {step}
                </span>
              </button>
            ) : (
              <div
                className={`flex items-center gap-2 text-sm ${
                  isCurrent
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <span
                  data-testid="step-marker"
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? 'border-2 border-primary bg-background text-primary'
                      : 'border border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {marker}
                </span>
                <span className="truncate">
                  {stepNumber}. {step}
                </span>
              </div>
            )}

            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={`hidden sm:block flex-1 h-0.5 mx-2 ${
                  isDone ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
