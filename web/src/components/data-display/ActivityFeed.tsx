import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';

export type ActivityFeedItem = {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  statusLabel?: string;
  statusTone?: StatusBadgeTone;
};

export type ActivityFeedProps = {
  items: readonly ActivityFeedItem[];
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay actividad reciente.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <article className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" key={item.id}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            {item.statusLabel ? (
              item.statusTone ? <StatusBadge label={item.statusLabel} tone={item.statusTone} /> : <StatusBadge label={item.statusLabel} />
            ) : null}
            <span className="text-[11px] text-slate-400">{item.timeLabel}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
