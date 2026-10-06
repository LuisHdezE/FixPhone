import { SurfaceCard } from '@/components/layout/SurfaceCard';

export type TrendChartPoint = {
  label: string;
  value: number;
};

export type TrendChartSeries = {
  id: string;
  label: string;
  tone: 'brand' | 'info' | 'success';
  points: readonly TrendChartPoint[];
};

export type TrendChartCardProps = {
  title: string;
  description?: string;
  periodLabel?: string;
  series: readonly TrendChartSeries[];
};

const strokeByTone = {
  brand: 'stroke-brand-500',
  info: 'stroke-sky-500',
  success: 'stroke-emerald-500',
} as const;

const dotByTone = {
  brand: 'fill-brand-500',
  info: 'fill-sky-500',
  success: 'fill-emerald-500',
} as const;

const legendByTone = {
  brand: 'bg-brand-500',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
} as const;

export function TrendChartCard({ title, description, periodLabel, series }: TrendChartCardProps) {
  const allValues = series.flatMap((item) => item.points.map((point) => point.value));
  const maxValue = Math.max(...allValues, 1);
  const chartLeft = 34;
  const chartTop = 18;
  const chartWidth = 486;
  const chartHeight = 150;
  const pointCount = Math.max(...series.map((item) => item.points.length), 1);
  const xFor = (index: number) => chartLeft + (pointCount <= 1 ? 0 : (index / (pointCount - 1)) * chartWidth);
  const yFor = (value: number) => chartTop + chartHeight - (value / maxValue) * chartHeight;

  return <SurfaceCard className="h-full" >
    <div data-analytics-widget="trend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {periodLabel ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{periodLabel}</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((item) => <span className="inline-flex items-center gap-2" key={item.id}>
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${legendByTone[item.tone]}`} />
          {item.label}
        </span>)}
      </div>

      <div className="mt-4 overflow-hidden">
        <svg aria-label={title} className="h-auto w-full min-w-[520px]" role="img" viewBox="0 0 554 205">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartTop + chartHeight - ratio * chartHeight;
            return <g key={ratio}>
              <line className="stroke-slate-200" strokeDasharray="3 5" x1={chartLeft} x2={chartLeft + chartWidth} y1={y} y2={y} />
              <text className="fill-slate-400 text-[10px]" x="0" y={y + 3}>{Math.round(maxValue * ratio)}</text>
            </g>;
          })}
          {series.map((item) => {
            const coordinates = item.points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(' ');
            return <g key={item.id}>
              <polyline className={strokeByTone[item.tone]} fill="none" points={coordinates} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              {item.points.map((point, index) => <circle className={dotByTone[item.tone]} cx={xFor(index)} cy={yFor(point.value)} key={`${item.id}-${point.label}`} r="3.5" />)}
            </g>;
          })}
          {(series[0]?.points ?? []).map((point, index) => <text className="fill-slate-400 text-[10px]" key={point.label} textAnchor="middle" x={xFor(index)} y="195">{point.label}</text>)}
        </svg>
      </div>
    </div>
  </SurfaceCard>;
}
