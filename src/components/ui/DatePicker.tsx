import { Calendar } from 'lucide-react';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

/**
 * Reusable date picker component with calendar icon
 * Uses native HTML date input with validation
 */
export default function DatePicker({
  label,
  value,
  onChange,
  required = false,
  minDate,
  maxDate,
  disabled = false,
  error,
  placeholder = 'Select date',
}: DatePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
        
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={minDate}
          max={maxDate}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full h-10 pl-10 pr-3 rounded-lg border-2 transition-colors
            text-sm font-medium text-ink bg-surface
            placeholder-ink-faint
            focus:outline-none
            ${error 
              ? 'border-red-500 focus:border-red-600' 
              : 'border-line focus:border-[#EA4335]'
            }
            ${disabled ? 'bg-surface-2 text-ink-faint cursor-not-allowed' : 'cursor-pointer'}
          `}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
}
