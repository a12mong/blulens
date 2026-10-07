'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type { components } from '@/lib/api/schema';
import { usePlayerSearch } from './api';

export type UserPickerItem = components['schemas']['UserPickerItem'];

export type PlayerValue = {
  userId: string;
  displayName: string;
};

export type PlayerPickerProps = {
  value: PlayerValue | null;
  onChange: (v: PlayerValue | null) => void;
  excludeUserIds?: string[];
};

export function PlayerPicker({
  value,
  onChange,
  excludeUserIds,
}: PlayerPickerProps) {
  const listboxId = useId();
  const [inputValue, setInputValue] = useState(value?.displayName ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const isTypingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      return;
    }
    setInputValue(value?.displayName ?? '');
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 250);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: players, isLoading } = usePlayerSearch(debouncedQuery, {
    enabled: isOpen && debouncedQuery.trim().length >= 1,
  });

  const filteredPlayers = ((players ?? []) as UserPickerItem[]).filter(
    (item) => !excludeUserIds || !excludeUserIds.includes(item.id),
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true;
    const next = e.target.value;
    setInputValue(next);
    onChange(null);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelect = (item: UserPickerItem) => {
    isTypingRef.current = false;
    onChange({ userId: item.id, displayName: item.displayName });
    setInputValue(item.displayName);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    if (filteredPlayers.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredPlayers.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredPlayers.length - 1,
      );
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredPlayers.length) {
        e.preventDefault();
        handleSelect(filteredPlayers[selectedIndex]);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsOpen(false);
  };

  const isAllExcluded = Boolean(
    players && players.length > 0 && filteredPlayers.length === 0,
  );
  const showEmpty = Boolean(
    isOpen &&
      debouncedQuery.trim().length >= 1 &&
      !isLoading &&
      filteredPlayers.length === 0,
  );

  return (
    <div ref={containerRef} className="relative w-full" onBlur={handleBlur}>
      <input
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          selectedIndex >= 0 && selectedIndex < filteredPlayers.length
            ? `${listboxId}-option-${selectedIndex}`
            : undefined
        }
        data-testid="player-input"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (inputValue.trim().length >= 1) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-full border border-input rounded px-3 py-2 text-sm bg-background text-foreground"
      />

      {isOpen && debouncedQuery.trim().length >= 1 && (
        <div className="absolute z-10 w-full mt-1 border border-border rounded bg-card shadow-md">
          {filteredPlayers.length > 0 ? (
            <ul
              role="listbox"
              id={listboxId}
              data-testid="player-options"
              className="max-h-60 overflow-auto"
            >
              {filteredPlayers.map((item, index) => {
                const isSelected = selectedIndex === index;
                const clubsText =
                  item.teamNames && item.teamNames.length > 0
                    ? item.teamNames.join(', ')
                    : 'ไม่มีสโมสร';
                const gradeBase = item.gradeLabel ?? 'ยังไม่มีเกรด';
                const gradeText = item.gradeProvisional
                  ? `${gradeBase} (ชั่วคราว)`
                  : gradeBase;
                const metaText = `${clubsText} · ${gradeText}`;

                return (
                  <li
                    key={item.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-testid="player-option"
                    className={`px-3 py-1.5 text-sm cursor-pointer flex flex-col justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(item)}
                  >
                    <span>{item.displayName}</span>
                    <span
                      data-testid="player-option-meta"
                      className={`text-xs ${
                        isSelected
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {metaText}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : showEmpty ? (
            <div className="p-2">
              <p
                data-testid="player-empty"
                className="text-xs text-muted-foreground text-center"
              >
                {isAllExcluded ? 'ผู้เล่นคนนี้ถูกเลือกไปแล้ว' : 'ไม่พบผู้เล่น'}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default PlayerPicker;
