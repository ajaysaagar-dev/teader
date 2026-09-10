'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T = string | number> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  description?: string;
}

export interface CustomDropdownProps<T = string | number> {
  value?: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; // Container className
  triggerClassName?: string; // Trigger button className
  menuClassName?: string; // Dropdown menu popup className
  optionClassName?: string; // Individual option className
  align?: 'left' | 'right';
  size?: 'xs' | 'sm' | 'md';
  showCheckmark?: boolean;
  showChevron?: boolean;
  title?: string;
  id?: string;
  renderTrigger?: (selectedOption: DropdownOption<T> | undefined, isOpen: boolean) => React.ReactNode;
}

export function CustomDropdown<T extends string | number = string>({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  optionClassName = '',
  align = 'left',
  size = 'sm',
  showCheckmark = true,
  showChevron = true,
  title,
  id,
  renderTrigger,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Determine open direction (upward vs downward)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedHeight = Math.min(options.length * 36 + 16, 260);
      if (spaceBelow < estimatedHeight && rect.top > estimatedHeight) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen, options.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          return;
        }

        const enabledOptions = options.filter((opt) => !opt.disabled);
        if (enabledOptions.length === 0) return;

        const currentIndex = enabledOptions.findIndex((opt) => opt.value === value);
        let nextIndex: number;

        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < enabledOptions.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : enabledOptions.length - 1;
        }

        onChange(enabledOptions[nextIndex].value);
      }
    },
    [disabled, isOpen, options, value, onChange]
  );

  const handleSelect = (option: DropdownOption<T>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (option.disabled || disabled) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const sizeClasses = {
    xs: 'text-xs py-1.5 px-2.5 gap-1.5 rounded-md',
    sm: 'text-sm py-2 px-3 gap-2 rounded-lg',
    md: 'text-sm py-2.5 px-4 gap-2.5 rounded-lg',
  }[size];

  const chevronSizes = {
    xs: 11,
    sm: 13,
    md: 14,
  }[size];

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
      title={title}
    >
      {renderTrigger ? (
        <div onClick={handleToggle} className="cursor-pointer">
          {renderTrigger(selectedOption, isOpen)}
        </div>
      ) : (
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full font-medium flex items-center justify-between text-left transition-colors outline-none cursor-pointer select-none ${
            disabled ? 'opacity-40 cursor-not-allowed' : ''
          } ${sizeClasses} ${
            triggerClassName ||
            'bg-[#16171A] hover:bg-[#1C1E22] text-[#CFD4DD] hover:text-white border border-[#2A2C30] hover:border-[#3A3C42] focus:border-[#DCB001]/60'
          }`}
        >
          <span className="flex items-center gap-2 truncate flex-1">
            {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          </span>

          {showChevron && (
            <ChevronDown
              size={chevronSizes}
              className={`shrink-0 text-[#9CA3AF] transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-white' : ''
              }`}
            />
          )}
        </button>
      )}

      {isOpen && (
        <div
          role="listbox"
          aria-activedescendant={selectedOption ? `${selectId}-opt-${selectedOption.value}` : undefined}
          className={`absolute z-[100] min-w-full min-w-[150px] w-max max-h-60 overflow-y-auto bg-[#141518] border border-[#2A2C30] rounded-lg shadow-2xl py-1 text-sm custom-scrollbar ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} ${menuClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[#9CA3AF] italic text-center">No options</div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  id={`${selectId}-opt-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={(e) => handleSelect(option, e)}
                  className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors ${
                    option.disabled
                      ? 'opacity-40 cursor-not-allowed text-[#9CA3AF]'
                      : isSelected
                      ? 'bg-[#DCB001]/10 text-[#DCB001] font-semibold hover:bg-[#DCB001]/15'
                      : 'text-[#E5E7EB] hover:bg-[#1F2126] hover:text-white cursor-pointer'
                  } ${optionClassName} ${option.className || ''}`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <div className="truncate">
                      <div className="truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-[#9CA3AF] font-normal truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {showCheckmark && isSelected && (
                    <Check size={13} className="text-[#DCB001] shrink-0 ml-1.5" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export const CustomSelect = CustomDropdown;
export default CustomDropdown;
