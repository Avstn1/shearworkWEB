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
    <div className="relative w-32" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`
          w-full flex justify-between items-center px-4 py-2 rounded-full font-semibold text-sm border shadow-md
          bg-gradient-to-r from-amber-500/30 to-lime-500/30 text-white
          transition-all duration-200
          ${disabled
            ? 'cursor-not-allowed opacity-80 animate-pulse shadow-[0_0_8px_#fffb85]'
            : 'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1'
          }
        `}
      >
        {selectedYear}
        <ChevronDown className="ml-2 h-4 w-4" />
      </button>

      {open && (
        <ul className="absolute mt-1 w-full rounded-lg border border-white/20 bg-[#1a1e18] shadow-lg z-50">
          {years.map((year) => (
            <li
              key={year}
              onClick={() => handleSelect(year)}
              className={`
                px-4 py-2 cursor-pointer select-none
                ${year === selectedYear ? 'bg-amber-300 text-black font-semibold' : 'text-white hover:bg-white/20 hover:text-black'}
              `}
            >
              {year}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
