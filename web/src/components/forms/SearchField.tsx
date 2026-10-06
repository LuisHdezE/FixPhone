import type { ChangeEvent } from 'react';

export type SearchFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchField({ id, label, value, onChange, placeholder = 'Buscar…' }: SearchFieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="grid gap-1.5" htmlFor={id}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <input
        className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        id={id}
        onChange={handleChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
