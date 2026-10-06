import { SurfaceCard } from '@/components/layout/SurfaceCard';

export type FunnelChartStage = {
  id: string;
  label: string;
  value: number;
  note?: string;
};

export type FunnelChartCardProps = {
  title: string;
  description?: string;
  stages: readonly FunnelChartStage[];
};

export function FunnelChartCard({ title, description, stages }: FunnelChartCardProps) {
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  return <SurfaceCard>
    <div data-analytics-widget="funnel">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5" role="img" aria-label={title}>
        {stages.map((stage, index) => {
          const percent = Math.max(10, Math.round((stage.value / maxValue) * 100));
          return <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3" data-funnel-stage key={stage.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-500">{stage.label}</p>
                <strong className="mt-1 block text-xl font-semibold text-slate-950">{stage.value}</strong>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">{index + 1}/{stages.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
            </div>
            {stage.note ? <p className="mt-2 text-[11px] leading-4 text-slate-500">{stage.note}</p> : null}
          </div>;
        })}
      </div>
    </div>
  </SurfaceCard>;
}
