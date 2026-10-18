import type { ChangeEvent } from 'react';

interface TextFieldProps {
  id?: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email';
  disabled?: boolean;
}

export function TextField({ id, label, defaultValue, value, onChange, placeholder, type = 'text', disabled = false }: TextFieldProps) {
  const controlled = value !== undefined;
  function handleChange(event: ChangeEvent<HTMLInputElement>) { onChange?.(event.target.value); }
  return (
    <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700" htmlFor={id}>
      {label}
      <input className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-normal text-slate-800 outline-none transition focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" defaultValue={controlled ? undefined : defaultValue} disabled={disabled} id={id} onChange={handleChange} placeholder={placeholder} type={type} value={controlled ? value : undefined} />
    </label>
  );
}
