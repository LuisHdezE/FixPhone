import { AppIcon, type AppIconName } from '@/components/AppIcon';

export type MetricCardTone = 'positive' | 'neutral' | 'warning';

export type MetricCardProps = {
  label: string;
  value: string;
  note?: string;
  tone?: MetricCardTone;
  icon?: AppIconName;
};

const noteClasses: Record<MetricCardTone, string> = {
  positive: 'text-emerald-600',
  neutral: 'text-slate-500',
  warning: 'text-amber-700',
};

export function MetricCard({ label, value, note, tone = 'neutral', icon }: MetricCardProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        {icon ? <span className="rounded-md bg-slate-100 p-1.5 text-slate-600"><AppIcon className="h-4 w-4" name={icon} /></span> : null}
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      {note ? <p className={`mt-1 text-[11px] font-semibold ${noteClasses[tone]}`}>{note}</p> : null}
    </article>
  );
}
