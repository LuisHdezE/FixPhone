import type { ChangeEvent } from 'react';

export type SearchFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchField({ id, label, value, onChange, placeholder = 'Buscarâ€¦' }: SearchFieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700" htmlFor={id}>
      {label}
      <input
        className="h-7 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        id={id}
        onChange={handleChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
