import type { ChangeEvent } from 'react';

export type SelectFieldOption<Value extends string> = {
  value: Value;
  label: string;
};

export type SelectFieldProps<Value extends string> = {
  id: string;
  label: string;
  value: Value;
  options: readonly SelectFieldOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
};

export function SelectField<Value extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectFieldProps<Value>) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value as Value);
  }

  return (
    <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700" htmlFor={id}>
      {label}
      <select
        className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        id={id}
        disabled={disabled}
        onChange={handleChange}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
