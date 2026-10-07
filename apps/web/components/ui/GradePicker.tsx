'use client';

import { useState, useRef } from 'react';
import { GRADE_KEYS, type GradeKey, type Tier } from './GradeBand';

const TIERS: readonly Tier[] = [
  'Rookie',
  'Rookie',
  'Rookie',
  'Beginner',
  'Beginner',
  'Beginner',
  'Standard',
  'Standard',
  'Standard',
  'Neutral',
  'Neutral',
  'Neutral',
  'Professional',
  'Professional',
  'Professional',
];

const TIER_NAMES: Record<Tier, string> = {
  Rookie: 'มือใหม่',
  Beginner: 'เริ่มต้น',
  Standard: 'มาตรฐาน',
  Neutral: 'กลาง',
  Professional: 'มืออาชีพ',
};

const TIER_COLORS: Record<Tier, string> = {
  Rookie: 'bg-blue-100 hover:bg-blue-200',
  Beginner: 'bg-cyan-100 hover:bg-cyan-200',
  Standard: 'bg-green-100 hover:bg-green-200',
  Neutral: 'bg-yellow-100 hover:bg-yellow-200',
  Professional: 'bg-red-100 hover:bg-red-200',
};

export type GradePickerProps = {
  value: GradeKey | null | undefined;
  onChange: (v: GradeKey | null | undefined) => void;
  allowNA?: boolean;
  anchorsByTier?: Partial<Record<Tier, string>>;
  disabled?: boolean;
  variant?: 'tiered' | 'ladder';
  'aria-label'?: string;
};

export function GradePicker({
  value,
  onChange,
  allowNA = false,
  anchorsByTier = {},
  disabled = false,
  variant = 'tiered',
  'aria-label': ariaLabel,
}: GradePickerProps) {
  const [expandedTier, setExpandedTier] = useState<Tier | null>(null);
  const [focusedKey, setFocusedKey] = useState<GradeKey | 'NA' | null>(value || (allowNA ? null : GRADE_KEYS[0]));
  const radioRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const currentTier = value ? TIERS[GRADE_KEYS.indexOf(value)] : null;
  const displayTier = expandedTier || currentTier;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, key: GradeKey | 'NA' | null = null) => {
    if (disabled) return;

    const allKeys = [...GRADE_KEYS, ...(allowNA ? ['NA'] : [])];
    const currentKey = key || (e.currentTarget.getAttribute('data-testid')?.replace('gp-key-', '').replace('gp-na', 'NA') as string);
    const currentIndex = allKeys.indexOf(currentKey as any);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % allKeys.length;
      const nextKey = allKeys[nextIndex];
      const nextBtn = radioRefs.current.get(nextKey as string);
      if (nextBtn) {
        nextBtn.focus();
        setFocusedKey(nextKey as any);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + allKeys.length) % allKeys.length;
      const prevKey = allKeys[prevIndex];
      const prevBtn = radioRefs.current.get(prevKey as string);
      if (prevBtn) {
        prevBtn.focus();
        setFocusedKey(prevKey as any);
      }
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (currentKey === 'NA') {
        onChange(value === null ? undefined : null);
      } else if (currentKey && currentKey !== 'NA') {
        onChange(currentKey as GradeKey);
      }
    }
  };

  if (variant === 'ladder') {
    return (
      <div
        role="radiogroup"
        data-testid="grade-picker"
        aria-label={ariaLabel || 'เลือกเกรด'}
        className="space-y-4"
      >
        {['Rookie', 'Beginner', 'Standard', 'Neutral', 'Professional'].map((tier) => {
          const tierKeys = GRADE_KEYS.filter((_, i) => TIERS[i] === tier);
          return (
            <div key={tier}>
              <p className="text-sm font-medium text-gray-700">{TIER_NAMES[tier as Tier]}</p>
              <div className="flex flex-wrap gap-2">
                {tierKeys.map((key) => (
                  <button
                    key={key}
                    ref={(el) => {
                      if (el) radioRefs.current.set(key, el);
                    }}
                    role="radio"
                    tabIndex={focusedKey === key ? 0 : -1}
                    aria-checked={value === key}
                    onClick={() => !disabled && onChange(key)}
                    onKeyDown={(e) => handleKeyDown(e, key)}
                    disabled={disabled}
                    data-testid={`gp-key-${key}`}
                    className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded font-medium transition-all ${
                      value === key ? 'ring-2 ring-blue-500 bg-white' : 'bg-gray-100 hover:bg-gray-200'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {key}
                    {value === key && <span className="ml-1">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {allowNA && (
          <button
            ref={(el) => {
              if (el) radioRefs.current.set('NA', el);
            }}
            role="radio"
            aria-checked={value === null}
            onClick={() => !disabled && onChange(value === null ? undefined : null)}
            onKeyDown={(e) => handleKeyDown(e, 'NA')}
            disabled={disabled}
            data-testid="gp-na"
            className={`w-full px-3 py-2 rounded font-medium transition-all ${
              value === null ? 'ring-2 ring-red-500 bg-white' : 'bg-gray-100 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {value === null && <span>✓ </span>}ประเมินไม่ได้
          </button>
        )}

        {displayTier && anchorsByTier[displayTier as Tier] && (
          <p data-testid="gp-anchor" className="text-sm text-gray-600 italic">
            {anchorsByTier[displayTier as Tier]}
          </p>
        )}
      </div>
    );
  }

  // Tiered variant (default)
  const uniqueTiers: Tier[] = ['Rookie', 'Beginner', 'Standard', 'Neutral', 'Professional'];
  const tierKeys = displayTier ? GRADE_KEYS.filter((_, i) => TIERS[i] === displayTier) : [];

  return (
    <div
      role="radiogroup"
      data-testid="grade-picker"
      aria-label={ariaLabel || 'เลือกเกรด'}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-2">
        {uniqueTiers.map((tier) => (
          <button
            key={tier}
            role="radio"
            tabIndex={displayTier === tier ? 0 : -1}
            aria-checked={displayTier === tier}
            onClick={() => !disabled && setExpandedTier(displayTier === tier ? null : tier)}
            disabled={disabled}
            data-testid={`gp-tier-${tier}`}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded font-medium transition-all ${TIER_COLORS[tier]} ${
              displayTier === tier ? 'ring-2 ring-blue-500' : ''
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {TIER_NAMES[tier]}
          </button>
        ))}
      </div>

      {displayTier && (
        <div className="flex flex-wrap gap-2 ml-4">
          {tierKeys.map((key) => (
            <button
              key={key}
              ref={(el) => {
                if (el) radioRefs.current.set(key, el);
              }}
              role="radio"
              aria-checked={value === key}
              onClick={() => !disabled && onChange(key)}
              onKeyDown={(e) => handleKeyDown(e, key)}
              disabled={disabled}
              data-testid={`gp-key-${key}`}
              className={`px-3 py-2 rounded font-medium transition-all ${
                value === key ? 'ring-2 ring-blue-500 bg-white' : 'bg-gray-100 hover:bg-gray-200'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {key}
              {value === key && <span className="ml-1">✓</span>}
            </button>
          ))}
        </div>
      )}

      {value !== undefined && (
        <button
          data-testid="gp-clear"
          onClick={() => !disabled && onChange(undefined)}
          disabled={disabled}
          className={`min-h-[44px] px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          ล้าง
        </button>
      )}

      {allowNA && (
        <button
          ref={(el) => {
            if (el) radioRefs.current.set('NA', el);
          }}
          role="radio"
          tabIndex={focusedKey === 'NA' ? 0 : -1}
          aria-checked={value === null}
          onClick={() => !disabled && onChange(value === null ? undefined : null)}
          onKeyDown={(e) => handleKeyDown(e, 'NA')}
          disabled={disabled}
          data-testid="gp-na"
          className={`w-full min-h-[44px] px-3 py-2 rounded font-medium transition-all ${
            value === null ? 'ring-2 ring-red-500 bg-white' : 'bg-gray-100 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {value === null && <span>✓ </span>}ประเมินไม่ได้
        </button>
      )}

      {displayTier && anchorsByTier[displayTier as Tier] && (
        <p data-testid="gp-anchor" className="text-sm text-gray-600 italic">
          {anchorsByTier[displayTier as Tier]}
        </p>
      )}
    </div>
  );
}
