'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';

export type FilterType =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone_normalized'
  | 'phone_available'
  | 'first_appt_month'
  | 'first_appt_year'
  | 'last_appt_month'
  | 'last_appt_year'
  | 'visiting_type'
  | 'sms_subscribed';

export type VisitingType = 'consistent' | 'semi-consistent' | 'easy-going' | 'rare' | 'new';

export interface ActiveFilter {
  id: string;
  type: FilterType;
  value: string | number | boolean;
  label: string;
}

interface FilterRow {
  id: string;
  type: FilterType | '';
  value: string;
}

interface ClientSheetsFilterDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  activeFilters: ActiveFilter[];
  onFiltersChange: (filters: ActiveFilter[]) => void;
  minYear: number;
}

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone_normalized', label: 'Phone' },
  { value: 'phone_available', label: 'Phone Available' },
  { value: 'first_appt_month', label: 'First Visit Month' },
  { value: 'first_appt_year', label: 'First Visit Year' },
  { value: 'last_appt_month', label: 'Last Visit Month' },
  { value: 'last_appt_year', label: 'Last Visit Year' },
  { value: 'visiting_type', label: 'Visiting Type' },
  { value: 'sms_subscribed', label: 'SMS Subscribed' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const VISITING_TYPES: { value: VisitingType; label: string }[] = [
  { value: 'consistent', label: 'Consistent' },
  { value: 'semi-consistent', label: 'Semi-Consistent' },
  { value: 'easy-going', label: 'Easy-Going' },
  { value: 'rare', label: 'Rare' },
  { value: 'new', label: 'New' },
];

export default function ClientSheetsFilterDropdown({
  isOpen,
  onToggle,
  activeFilters,
  onFiltersChange,
  minYear,
}: ClientSheetsFilterDropdownProps) {
  const [filterRows, setFilterRows] = useState<FilterRow[]>([
    { id: Date.now().toString(), type: '', value: '' },
  ]);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Check if clicking the toggle button
        const target = event.target as HTMLElement;
        if (target.closest('[data-filter-toggle]')) {
          return; // Let the button's onClick handle it
        }
        // Don't close if clicking on active filter chips
        if (!target.closest('[data-filter-chip]')) {
          if (isOpen) {
            onToggle();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const getLabelForValue = (type: FilterType, value: string | number | boolean): string => {
    if (type === 'first_appt_month' || type === 'last_appt_month') {
      const month = MONTHS.find((m) => m.value === Number(value));
      return month?.label || String(value);
    }
    if (type === 'visiting_type') {
      const vType = VISITING_TYPES.find((v) => v.value === value);
      return vType?.label || String(value);
    }
    if (type === 'sms_subscribed' || type === 'phone_available') {
      return value === 'true' ? 'Yes' : 'No';
    }
    return String(value);
  };

  const addOrUpdateFilter = (rowId: string, type: FilterType, value: string) => {
    if (!type || !value) return;

    const filterOption = FILTER_OPTIONS.find((f) => f.value === type);
    if (!filterOption) return;

    const newFilter: ActiveFilter = {
      id: `${type}-${Date.now()}`,
      type: type,
      value: value,
      label: `${filterOption.label}: ${getLabelForValue(type, value)}`,
    };

    // Remove existing filter of same type, add new one
    const otherFilters = activeFilters.filter((f) => f.type !== type);
    onFiltersChange([...otherFilters, newFilter]);
  };

  const handleFilterTypeChange = (rowId: string, newType: FilterType | '') => {
    setFilterRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, type: newType, value: '' } : row))
    );

    // Remove existing filter if changing type
    if (newType) {
      const newFilters = activeFilters.filter((f) => f.type !== newType);
      onFiltersChange(newFilters);
    }
  };

  const handleFilterValueChange = (rowId: string, value: string) => {
    const row = filterRows.find((r) => r.id === rowId);
    if (!row || !row.type) return;

    setFilterRows((rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, value } : r))
    );

    // Clear existing timer for this row
    const existingTimer = debounceTimers.current.get(rowId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // For text inputs, debounce
    if (
      row.type === 'first_name' ||
      row.type === 'last_name' ||
      row.type === 'email' ||
      row.type === 'phone_normalized'
    ) {
      if (!value.trim()) {
        // Remove filter if value is empty
        const newFilters = activeFilters.filter((f) => f.type !== row.type);
        onFiltersChange(newFilters);
        return;
      }

      const timer = setTimeout(() => {
        addOrUpdateFilter(rowId, row.type as FilterType, value);
      }, 500);
      debounceTimers.current.set(rowId, timer);
    } else {
      // For dropdowns, immediate update
      if (!value) {
        const newFilters = activeFilters.filter((f) => f.type !== row.type);
        onFiltersChange(newFilters);
      } else {
        addOrUpdateFilter(rowId, row.type as FilterType, value);
      }
    }
  };

  const addFilterRow = () => {
    setFilterRows((rows) => [...rows, { id: Date.now().toString(), type: '', value: '' }]);
  };

  const removeFilterRow = (rowId: string) => {
    const row = filterRows.find((r) => r.id === rowId);
    if (row && row.type) {
      // Remove the associated filter
      const newFilters = activeFilters.filter((f) => f.type !== row.type);
      onFiltersChange(newFilters);
    }
    setFilterRows((rows) => rows.filter((r) => r.id !== rowId));
  };

  const renderFilterInput = (row: FilterRow) => {
    const inputClass = "field !h-9 min-w-0 flex-1 !text-[13px]";

    if (!row.type) {
      return (
        <input
          type="text"
          disabled
          value=""
          placeholder="Select a filter first"
          className="field !h-9 min-w-0 flex-1 !text-[13px] cursor-not-allowed opacity-50"
        />
      );
    }

    // Text inputs
    if (
      row.type === 'first_name' ||
      row.type === 'last_name' ||
      row.type === 'email' ||
      row.type === 'phone_normalized'
    ) {
      return (
        <input
          type="text"
          value={row.value || ''}
          onChange={(e) => handleFilterValueChange(row.id, e.target.value)}
          placeholder={`Enter ${FILTER_OPTIONS.find((f) => f.value === row.type)?.label.toLowerCase()}...`}
          className={inputClass}
        />
      );
    }

    // Month selectors
    if (row.type === 'first_appt_month' || row.type === 'last_appt_month') {
      return (
        <select
          value={row.value || ''}
          onChange={(e) => handleFilterValueChange(row.id, e.target.value)}
          className={inputClass}
        >
          <option value="">Select month</option>
          {MONTHS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      );
    }

    // Year selectors
    if (row.type === 'first_appt_year' || row.type === 'last_appt_year') {
      const currentYear = new Date().getFullYear();
      const yearCount = currentYear - minYear + 1;
      const years = Array.from({ length: yearCount }, (_, i) => currentYear - i);

      return (
        <select
          value={row.value || ''}
          onChange={(e) => handleFilterValueChange(row.id, e.target.value)}
          className={inputClass}
        >
          <option value="">Select year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      );
    }

    // Visiting type
    if (row.type === 'visiting_type') {
      return (
        <select
          value={row.value || ''}
          onChange={(e) => handleFilterValueChange(row.id, e.target.value)}
          className={inputClass}
        >
          <option value="">Select type</option>
          {VISITING_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      );
    }

    // SMS subscribed
    if (row.type === 'sms_subscribed' || row.type === 'phone_available') {
      return (
        <select
          value={row.value || ''}
          onChange={(e) => handleFilterValueChange(row.id, e.target.value)}
          className={inputClass}
        >
          <option value="">Select</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="modal-surface absolute top-full right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-[26rem] sm:w-[26rem]">
      <div className="space-y-2 p-3">
        {filterRows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <select
              value={row.type}
              onChange={(e) => handleFilterTypeChange(row.id, e.target.value as FilterType)}
              className="field !h-9 !w-36 shrink-0 !text-[13px]"
            >
              <option value="">Select filter</option>
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderFilterInput(row)}

            {filterRows.length > 1 && (
              <button
                onClick={() => removeFilterRow(row.id)}
                className="btn btn-ghost btn-sm !px-2"
                aria-label="Remove filter row"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
          <button
            onClick={addFilterRow}
            className="btn btn-glass btn-sm"
          >
            <Plus size={14} strokeWidth={1.75} />
            Add Filter
          </button>

          {activeFilters.length > 0 && (
            <button
              onClick={() => {
                onFiltersChange([]);
                setFilterRows([{ id: Date.now().toString(), type: '', value: '' }]);
              }}
              className="btn btn-ghost btn-sm !text-[#D99A8B]"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}