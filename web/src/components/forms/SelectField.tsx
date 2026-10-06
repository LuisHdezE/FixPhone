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
};

export function SelectField<Value extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<Value>) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value as Value);
  }

  return (
    <label className="grid gap-1.5" htmlFor={id}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <select
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        id={id}
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
