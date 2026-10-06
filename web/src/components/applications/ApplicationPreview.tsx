import type { ApplicationDefinition } from '@/applications/application.types';

type ApplicationPreviewProps = {
  application: ApplicationDefinition;
  compact?: boolean;
};

export function ApplicationPreview({ application, compact = false }: ApplicationPreviewProps) {
  const visiblePages = application.demoPages.slice(0, compact ? 4 : 5);
  const isDark = application.shellVariant === 'vertical-dark-menu';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
        <span className="size-2 rounded-full bg-slate-300" />
        <span className="size-2 rounded-full bg-slate-300" />
        <span className="size-2 rounded-full bg-slate-300" />
        <div className="ml-1.5 h-5 flex-1 rounded bg-slate-100" />
      </div>

      <div className={`grid ${compact ? 'min-h-44 grid-cols-[58px_1fr]' : 'min-h-56 grid-cols-[70px_1fr] sm:grid-cols-[96px_1fr]'}`}>
        <aside className={`border-r p-2.5 ${isDark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800'}`}>
          <div className="mb-3 grid size-7 place-items-center rounded-lg bg-brand-600 text-[9px] font-bold text-white">{application.name.slice(0, 2).toUpperCase()}</div>
          <div className="grid gap-1.5">
            {visiblePages.map((page, index) => (
              <div key={page.id} className={`h-5 rounded ${index === 0 ? 'bg-brand-100' : isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                <span className="sr-only">{page.label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="bg-slate-50 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="h-2 w-16 rounded-full bg-brand-100" />
              <div className="mt-1.5 h-4 w-28 max-w-full rounded bg-slate-700" />
            </div>
            <div className="size-7 rounded-full bg-white shadow-sm ring-1 ring-slate-200" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className={`${item === 2 ? 'hidden sm:block' : ''} rounded-lg border border-slate-200 bg-white p-2 shadow-sm`}>
                <div className="h-1.5 w-10 rounded-full bg-slate-200" />
                <div className="mt-2 h-4 w-14 rounded bg-slate-600" />
              </div>
            ))}
          </div>

          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-2 w-20 rounded-full bg-slate-300" />
              <div className="h-5 w-12 rounded bg-brand-50" />
            </div>
            <div className="mt-3 grid gap-1.5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="grid grid-cols-[1fr_42px] items-center gap-2 border-t border-slate-100 pt-1.5 first:border-0 first:pt-0">
                  <div className="h-2 rounded-full bg-slate-100" />
                  <div className="h-4 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
