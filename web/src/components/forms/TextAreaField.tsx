import type { ChangeEvent } from 'react';

interface TextAreaFieldProps {
  id?: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function TextAreaField({ id, label, defaultValue, value, onChange, placeholder, rows }: TextAreaFieldProps) {
  const controlled = value !== undefined;
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) { onChange?.(event.target.value); }
  return (
    <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700" htmlFor={id}>
      {label}
      <textarea className="min-h-16 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-normal text-slate-800 outline-none transition focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary-soft)]" defaultValue={controlled ? undefined : defaultValue} id={id} onChange={handleChange} placeholder={placeholder} rows={rows} value={controlled ? value : undefined} />
    </label>
  );
}
