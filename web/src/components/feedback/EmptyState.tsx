import type { ReactNode } from 'react';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: AppIconName;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon = 'layers', action, className = '' }: EmptyStateProps) {
  return (
    <div className={`grid min-h-52 place-items-center text-center ${className}`}>
      <div>
        <div className="mx-auto grid size-10 place-items-center rounded-md bg-slate-100 text-slate-500"><AppIcon className="size-5" name={icon} /></div>
        <p className="mt-3 text-[12px] font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-[11px] text-slate-500">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
