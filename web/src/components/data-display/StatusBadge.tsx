export type StatusBadgeTone = 'success' | 'warning' | 'info' | 'neutral';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-100',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}
