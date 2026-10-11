import type { FormEvent, ReactNode } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';

export function FormModal({
  title,
  children,
  onSubmit,
  onCancel,
  submitLabel,
  error,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitLabel: string;
  error?: string | null;
}) {
  return (
    <ModalShell title={title} onClose={onCancel}>
      <form className="p-3" data-master-data-form onSubmit={onSubmit}>
        {error ? (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" role="alert">
            {error}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
        <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="rounded-md bg-[var(--theme-primary)] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-95" type="submit">
            {submitLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
