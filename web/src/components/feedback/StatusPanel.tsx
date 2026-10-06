import { Link } from 'react-router';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

interface StatusPanelProps {
  code?: string;
  title: string;
  description: string;
  icon?: AppIconName;
  tone?: 'neutral' | 'warning';
  actionLabel?: string;
  actionTo?: string;
}

export function StatusPanel({ code, title, description, icon = 'settings', tone = 'neutral', actionLabel, actionTo }: StatusPanelProps) {
  const warning = tone === 'warning';
  return (
    <div className={`mx-auto max-w-2xl rounded-md border p-8 text-center ${warning ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
      {code ? <p className="text-6xl font-semibold tracking-[-0.06em] text-[var(--theme-primary)]">{code}</p> : <div className={`mx-auto grid size-12 place-items-center rounded-full ${warning ? 'bg-amber-100 text-amber-700' : 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]'}`}><AppIcon className="size-6" name={icon} /></div>}
      <h2 className="mt-3 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-5 text-slate-500">{description}</p>
      {actionLabel && actionTo ? <Link className="mt-5 inline-flex rounded-md bg-[var(--theme-primary)] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[var(--theme-primary-hover)]" to={actionTo}>{actionLabel}</Link> : null}
    </div>
  );
}
