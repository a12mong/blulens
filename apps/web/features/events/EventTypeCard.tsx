'use client';

import React, { useId } from 'react';
import { GradeRangeSelect } from '@/components/ui/GradeRangeSelect';
import type { GradeKey } from '@/components/ui/GradeBand';
import { FORMAT_PRESETS, type FormatPresetKey } from './formatPresets';

export type EventTypeDraft = {
  discipline: 'MS' | 'WS' | 'MD' | 'WD' | 'XD';
  gradeMin: GradeKey;
  gradeMax: GradeKey;
  maxEntries?: number;
  requiresFreshAssessment: boolean;
  minReviewers: number;
  formatPreset: FormatPresetKey;
};

export function defaultEventType(): EventTypeDraft {
  return {
    discipline: 'XD',
    gradeMin: 'S-',
    gradeMax: 'S+',
    maxEntries: undefined,
    requiresFreshAssessment: false,
    minReviewers: 2,
    formatPreset: 'knockout',
  };
}

export type EventTypeCardProps = {
  value: EventTypeDraft;
  onChange: (v: EventTypeDraft) => void;
  onRemove?: () => void;
  errors?: Partial<Record<'discipline' | 'grade' | 'maxEntries', string>>;
};

const DISCIPLINES: { value: EventTypeDraft['discipline']; label: string }[] = [
  { value: 'MD', label: 'ชายคู่ MD' },
  { value: 'WD', label: 'หญิงคู่ WD' },
  { value: 'XD', label: 'คู่ผสม XD' },
  { value: 'MS', label: 'ชายเดี่ยว MS' },
  { value: 'WS', label: 'หญิงเดี่ยว WS' },
];

export function EventTypeCard({
  value,
  onChange,
  onRemove,
  errors,
}: EventTypeCardProps) {
  const radioGroupId = useId();
  const disciplineSelectId = useId();
  const maxEntriesInputId = useId();
  const freshCheckboxId = useId();

  return (
    <div className="border border-border rounded-lg p-4 bg-card text-card-foreground shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h4 className="text-sm font-semibold">ประเภทการแข่งขัน</h4>
        {onRemove ? (
          <button
            type="button"
            data-testid="etc-remove"
            onClick={onRemove}
            className="text-xs text-destructive hover:underline cursor-pointer"
          >
            ลบประเภทนี้
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={disciplineSelectId}
          className="text-xs font-medium text-muted-foreground"
        >
          ประเภท (มือแข่ง)
        </label>
        <select
          id={disciplineSelectId}
          data-testid="etc-discipline"
          value={value.discipline}
          onChange={(e) =>
            onChange({
              ...value,
              discipline: e.target.value as EventTypeDraft['discipline'],
            })
          }
          className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
        >
          {DISCIPLINES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {errors?.discipline ? (
          <p
            role="alert"
            data-testid="etc-error-discipline"
            className="text-xs text-destructive mt-0.5"
          >
            {errors.discipline}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <GradeRangeSelect
          min={value.gradeMin}
          max={value.gradeMax}
          onChange={({ min, max }) =>
            onChange({
              ...value,
              gradeMin: min,
              gradeMax: max,
            })
          }
          error={errors?.grade}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={maxEntriesInputId}
          className="text-xs font-medium text-muted-foreground"
        >
          จำนวนคู่สูงสุด (ไม่บังคับ)
        </label>
        <input
          id={maxEntriesInputId}
          type="number"
          min={2}
          max={256}
          data-testid="etc-max-entries"
          value={value.maxEntries ?? ''}
          placeholder="เช่น 16 หรือ 32"
          onChange={(e) => {
            const val = e.target.value;
            onChange({
              ...value,
              maxEntries: val === '' ? undefined : Number(val),
            });
          }}
          className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
        />
        {errors?.maxEntries ? (
          <p
            role="alert"
            data-testid="etc-error-max-entries"
            className="text-xs text-destructive mt-0.5"
          >
            {errors.maxEntries}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          id={freshCheckboxId}
          type="checkbox"
          data-testid="etc-fresh"
          checked={value.requiresFreshAssessment}
          onChange={(e) =>
            onChange({
              ...value,
              requiresFreshAssessment: e.target.checked,
            })
          }
          className="rounded border border-border h-4 w-4 text-primary focus:ring-primary"
        />
        <label
          htmlFor={freshCheckboxId}
          className="text-xs text-foreground cursor-pointer"
        >
          ต้องประเมินใหม่สำหรับอีเวนต์นี้
        </label>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <span className="text-xs font-medium text-muted-foreground">
          รูปแบบการแข่งขัน
        </span>
        <div
          data-testid="etc-format"
          role="radiogroup"
          aria-label="รูปแบบการแข่งขัน"
          className="flex flex-col gap-2"
        >
          {(
            ['knockout', 'groups_knockout'] as const
          ).map((key) => {
            const preset = FORMAT_PRESETS[key];
            const isSelected = value.formatPreset === key;
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name={`etc-format-${radioGroupId}`}
                  data-testid={`etc-format-${key}`}
                  value={key}
                  checked={isSelected}
                  onChange={() =>
                    onChange({
                      ...value,
                      formatPreset: key,
                    })
                  }
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {preset.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {preset.hint}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EventTypeCard;
