import { useState } from 'react';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  REFERENCE_PRICE_CSV_HEADER,
  REFERENCE_PRICE_PROMPT_VERSION,
  buildReferencePriceCsvPrompt,
} from '../application/referencePriceCsvPrompt';

const pricePrompt = buildReferencePriceCsvPrompt();

export function ReferencePricesPage() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(pricePrompt);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <PageShell
      title="Precios de referencia"
      description="Consultá y actualizá bajo demanda las tarifas de Apple y MundoMac con un CSV compatible con FixPhone."
      breadcrumbs={[{ label: 'Administración' }, { label: 'Precios de referencia' }]}
    >
      <div className="grid gap-3" data-reference-price-prompt-version={REFERENCE_PRICE_PROMPT_VERSION}>
        <SurfaceCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold text-slate-900">Generar CSV con ChatGPT</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Copiá las instrucciones completas, pegálas en un chat nuevo de ChatGPT y descargá el CSV resultante.
                El prompt incluye las fuentes, los modelos, las reglas de validación y el formato de importación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="rounded-md bg-[var(--theme-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2"
            >
              Copiar prompt para actualizar precios
            </button>
          </div>
          {status === 'copied' ? (
            <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
              Prompt copiado. Abrí ChatGPT y pegalo en un chat nuevo.
            </p>
          ) : null}
          {status === 'failed' ? (
            <p role="alert" className="mt-2 text-xs text-amber-800">
              El navegador no permitió copiar automáticamente. Abrí «Ver prompt completo» y copialo manualmente.
            </p>
          ) : null}
          <details className="mt-3 border-t border-slate-100 pt-2">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--theme-primary)]">Ver prompt completo (versión {REFERENCE_PRICE_PROMPT_VERSION})</summary>
            <textarea
              aria-label="Prompt completo para actualizar precios"
              className="mt-2 h-52 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-5 text-slate-700"
              readOnly
              value={pricePrompt}
              onFocus={(event) => event.currentTarget.select()}
            />
          </details>
        </SurfaceCard>
        <SurfaceCard>
          <h2 className="text-sm font-bold text-slate-900">Formato que recibirá FixPhone</h2>
          <p className="mt-1 text-xs text-slate-600">
            CSV UTF-8, con coma como delimitador y 13 columnas en el siguiente orden:
          </p>
          <code className="mt-2 block overflow-x-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-700">
            {REFERENCE_PRICE_CSV_HEADER}
          </code>
          <p className="mt-2 text-xs text-slate-600">
            El importador y el comparador están pendientes de implementación. Por ahora esta pantalla solamente
            permite obtener y revisar el prompt, sin subir ni alterar precios existentes.
          </p>
        </SurfaceCard>
        <p className="text-[11px] text-slate-500">
          Fuentes: <a className="underline" href="https://support.apple.com/es-es/iphone/repair" rel="noopener noreferrer" target="_blank">Apple (España)</a>
          {' · '}
          <a className="underline" href="https://soporte.mundomac.com/iPhone/" rel="noopener noreferrer" target="_blank">MundoMac (Uruguay)</a>.
          Los importes deben conservar país y moneda de origen.
        </p>
      </div>
    </PageShell>
  );
}
