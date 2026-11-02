import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface YearDropdownProps {
  years: number[];
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  disabled?: boolean;
}

export default function YearDropdown({ years, selectedYear, setSelectedYear, disabled }: YearDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (year: number) => {
    if (!disabled) {
      setSelectedYear(year);
      setOpen(false);
    }
  };

  return (
    <div className="relative w-24" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex h-9 items-center justify-between gap-2 rounded-lg border border-white/[0.09] bg-canvas px-3 text-sm font-medium text-ivory transition-colors hover:border-white/[0.16] w-full tabular-nums ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {selectedYear}
        <ChevronDown strokeWidth={1.75} className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <ul role="listbox" className="absolute z-50 mt-1 w-full rounded-lg border border-white/[0.12] bg-raised py-1 shadow-lg">
          {years.map((year) => (
            <li
              key={year}
              role="option"
              aria-selected={year === selectedYear}
              onClick={() => handleSelect(year)}
              className={`w-full cursor-pointer select-none px-3 py-1.5 text-left text-sm transition-colors tabular-nums ${year === selectedYear ? 'bg-sage/[0.12] text-sage-bright' : 'text-gray-300 hover:bg-white/[0.05] hover:text-ivory'}`}
            >
              {year}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
