import type { PropsWithChildren } from 'react';

interface SurfaceCardProps extends PropsWithChildren {
  className?: string;
}

export function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return <section className={`rounded-md border border-slate-200 bg-white p-3 ${className}`}>{children}</section>;
}
