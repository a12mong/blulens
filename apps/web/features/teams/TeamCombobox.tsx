'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useRequestTeam, useTeamSuggestions, type TeamSuggestion } from './api';

export type TeamValue = {
  teamId: string;
  name: string;
};

export type TeamComboboxProps = {
  value: TeamValue | null;
  onChange: (v: TeamValue | null) => void;
};

export function TeamCombobox({ value, onChange }: TeamComboboxProps) {
  const listboxId = useId();
  const [inputValue, setInputValue] = useState(value?.name ?? '');
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
    setInputValue(value?.name ?? '');
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 250);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: suggestions, isLoading } = useTeamSuggestions(debouncedQuery, {
    enabled: isOpen && debouncedQuery.trim().length >= 1,
  });

  const requestTeamMutation = useRequestTeam();

  useEffect(() => {
    if (requestTeamMutation.isSuccess || requestTeamMutation.isError) {
      requestTeamMutation.reset();
    }
  }, [debouncedQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true;
    const next = e.target.value;
    setInputValue(next);
    onChange(null);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelect = (item: TeamSuggestion) => {
    isTypingRef.current = false;
    onChange({ teamId: item.teamId, name: item.name });
    setInputValue(item.name);
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

    if (!suggestions || suggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsOpen(false);
  };

  const showNoMatch = Boolean(
    isOpen &&
      debouncedQuery.trim().length >= 1 &&
      !isLoading &&
      suggestions &&
      suggestions.length === 0,
  );

  return (
    <div ref={containerRef} className="relative w-full" onBlur={handleBlur}>
      <input
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          selectedIndex >= 0 && suggestions && selectedIndex < suggestions.length
            ? `${listboxId}-option-${selectedIndex}`
            : undefined
        }
        data-testid="team-input"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (inputValue.trim().length >= 1) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
      />

      {isOpen && debouncedQuery.trim().length >= 1 && (
        <div className="absolute z-10 w-full mt-1 border rounded bg-card shadow-md">
          {suggestions && suggestions.length > 0 ? (
            <ul
              role="listbox"
              id={listboxId}
              data-testid="team-options"
              className="max-h-60 overflow-auto"
            >
              {suggestions.map((item, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <li
                    key={item.teamId}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-testid="team-option"
                    className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(item)}
                  >
                    <span>{item.name}</span>
                    {item.matchedAlias ? (
                      <span className="text-xs text-muted-foreground ml-2">
                        (ชื่อเดิม: {item.matchedAlias})
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : showNoMatch ? (
            <div className="p-2">
              {requestTeamMutation.isSuccess ? (
                <p
                  role="status"
                  data-testid="team-request-sent"
                  className="text-xs text-muted-foreground"
                >
                  ส่งคำขอแล้ว รอคณะกรรมการอนุมัติ
                </p>
              ) : (
                <button
                  type="button"
                  data-testid="team-request-new"
                  onClick={() =>
                    requestTeamMutation.mutate({ name: debouncedQuery.trim() })
                  }
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {`ขอเพิ่มทีม "${debouncedQuery.trim()}"`}
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default TeamCombobox;
