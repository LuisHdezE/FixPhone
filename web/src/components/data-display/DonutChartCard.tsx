import { SurfaceCard } from '@/components/layout/SurfaceCard';

export type DonutChartSegment = {
  id: string;
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'success' | 'warning' | 'neutral';
};

export type DonutChartCardProps = {
  title: string;
  description?: string;
  centerLabel?: string;
  segments: readonly DonutChartSegment[];
};

const strokeByTone = {
  brand: 'stroke-brand-500',
  info: 'stroke-sky-500',
  success: 'stroke-emerald-500',
  warning: 'stroke-amber-500',
  neutral: 'stroke-slate-400',
} as const;

const bulletByTone = {
  brand: 'bg-brand-500',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  neutral: 'bg-slate-400',
} as const;

export function DonutChartCard({ title, description, centerLabel = 'Total', segments }: DonutChartCardProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const circumference = 2 * Math.PI * 44;
  const arcs = segments.map((segment, index) => {
    const length = total > 0 ? (segment.value / total) * circumference : 0;
    const previousValue = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0);
    const currentOffset = total > 0 ? (previousValue / total) * circumference : 0;
    return { segment, length, currentOffset };
  });

  return <SurfaceCard className="h-full">
    <div data-analytics-widget="donut">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}

      <div className="mt-5 flex justify-center">
        <div className="relative h-44 w-44">
          <svg aria-label={title} className="h-full w-full -rotate-90" role="img" viewBox="0 0 120 120">
            <circle className="stroke-slate-100" cx="60" cy="60" fill="none" r="44" strokeWidth="14" />
            {arcs.map(({ segment, length, currentOffset }) => <circle
              className={strokeByTone[segment.tone]}
              cx="60"
              cy="60"
              fill="none"
              key={segment.id}
              r="44"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              strokeWidth="14"
            />)}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-medium text-slate-400">{centerLabel}</span>
            <strong className="mt-1 text-2xl font-semibold text-slate-950">{total}</strong>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {segments.map((segment) => <div className="flex items-center justify-between gap-3 text-xs" key={segment.id}>
          <span className="inline-flex min-w-0 items-center gap-2 text-slate-600">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${bulletByTone[segment.tone]}`} />
            <span className="truncate">{segment.label}</span>
          </span>
          <strong className="font-semibold text-slate-800">{segment.value}</strong>
        </div>)}
      </div>
    </div>
  </SurfaceCard>;
}
