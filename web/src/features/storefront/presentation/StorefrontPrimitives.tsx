import type { ReactNode } from 'react';

interface StorefrontPageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: ReactNode;
}

export function StorefrontPageIntro({ eyebrow, title, description, trailing }: StorefrontPageIntroProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between" data-storefront-page-intro>
      <div className="max-w-3xl">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">{description}</p>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

interface StorefrontSectionIntroProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function StorefrontSectionIntro({ eyebrow, title, description }: StorefrontSectionIntroProps) {
  return (
    <div className="max-w-3xl" data-storefront-section-intro>
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-base font-black tracking-[-0.02em] text-slate-950 sm:text-lg">{title}</h2>
      <p className="mt-1.5 text-xs leading-5 text-slate-600">{description}</p>
    </div>
  );
}

export const storefrontSurfaceClass = 'rounded-xl border border-black/10 bg-white shadow-sm';
