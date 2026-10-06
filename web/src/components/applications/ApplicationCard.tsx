import { Link } from 'react-router';
import { getCapabilityLabel } from '@/applications/applicationRegistry';
import type { ApplicationDefinition } from '@/applications/application.types';
import { ApplicationPreview } from '@/components/applications/ApplicationPreview';

type ApplicationCardProps = {
  application: ApplicationDefinition;
};

export function ApplicationCard({ application }: ApplicationCardProps) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-md">
      <div className="p-2.5 pb-1.5">
        <ApplicationPreview application={application} compact />
      </div>
      <div className="p-4 pt-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-brand-600">{application.category}</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Demo disponible</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{application.name}</h2>
        <p className="mt-2 text-sm leading-5 text-slate-600">{application.summary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {application.capabilities.slice(0, 4).map((capability) => (
            <span key={capability} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {getCapabilityLabel(capability)}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Link className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700" to={`/apps/${application.slug}`}>
            Ver aplicación
          </Link>
          <Link className="text-sm font-semibold text-brand-700 hover:text-brand-800" to={`/demo/${application.slug}/${application.demoPages[0]?.path ?? ''}`}>
            Abrir demo →
          </Link>
        </div>
      </div>
    </article>
  );
}
