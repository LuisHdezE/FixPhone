import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  getAiPrompt,
  listAiPrompts,
  type AiPromptDetail,
  type AiPromptSummary,
} from '../infrastructure/aiPromptCatalogGateway';

export function AiPromptCatalogPage() {
  const [prompts, setPrompts] = useState<AiPromptSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AiPromptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestSequence = useRef(0);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return prompts.filter((prompt) =>
      prompt.code.toLocaleLowerCase('es').includes(term) ||
      prompt.description.toLocaleLowerCase('es').includes(term),
    );
  }, [prompts, search]);

  useEffect(() => {
    let alive = true;
    listAiPrompts()
      .then((data) => { if (alive) setPrompts(data); })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la biblioteca.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function openPrompt(code: string, copy: boolean) {
    const sequence = ++requestSequence.current;
    setError('');
    setNotice('');
    setBusyCode(code);
    try {
      const prompt = selected?.code === code ? selected : await getAiPrompt(code);
      if (sequence !== requestSequence.current) return;
      setSelected(prompt);
      if (copy) {
        try {
          await navigator.clipboard.writeText(prompt.content);
          setNotice('Prompt ' + prompt.code + ' copiado. Pegalo en un chat nuevo de ChatGPT.');
        } catch {
          setError('El navegador bloqueó el portapapeles. Seleccioná y copiá manualmente el texto de abajo.');
        }
      }
    } catch (reason) {
      if (sequence === requestSequence.current) {
        setError(reason instanceof Error ? reason.message : 'No se pudo abrir el prompt.');
      }
    } finally {
      if (sequence === requestSequence.current) setBusyCode(null);
    }
  }

  return (
    <PageShell
      title="Biblioteca de prompts"
      description="Instrucciones reutilizables guardadas en la base de datos de FixPhone. Abrí una operación o copiá su prompt completo."
      breadcrumbs={[{ label: 'Administración' }, { label: 'Prompts de IA' }]}
    >
      <div className="grid gap-3" data-ai-prompts>
        {error ? <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{error}</p> : null}
        {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p> : null}
        <SurfaceCard>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Operaciones disponibles</h2>
            <input
              aria-label="Buscar prompts"
              className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs sm:w-72"
              placeholder="Buscar por código o descripción"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {loading ? <p className="mt-3 text-xs text-slate-500">Cargando prompts…</p> : null}
          {!loading && filtered.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No hay prompts que coincidan con la búsqueda.</p>
          ) : null}
          {filtered.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[450px] text-left text-xs">
                <thead><tr className="border-b text-slate-500">
                  <th className="p-2">Código</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {filtered.map((prompt) => (
                    <tr key={prompt.code} className="border-b border-slate-100">
                      <td className="p-2 font-mono">{prompt.code}</td>
                      <td className="p-2">{prompt.description}</td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busyCode !== null}
                            className="rounded-md border border-slate-200 px-2 py-1 font-semibold hover:bg-slate-50 disabled:opacity-50"
                            onClick={() => void openPrompt(prompt.code, false)}
                          >Ver</button>
                          <button
                            type="button"
                            disabled={busyCode !== null}
                            className="rounded-md bg-[var(--theme-primary)] px-2 py-1 font-semibold text-white disabled:opacity-50"
                            onClick={() => void openPrompt(prompt.code, true)}
                          >{busyCode === prompt.code ? 'Cargando…' : 'Copiar'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SurfaceCard>
        {selected ? <SurfaceCard>
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{selected.description}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">{selected.code}</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              onClick={() => void openPrompt(selected.code, true)}
            >Copiar prompt</button>
          </div>
          <textarea
            aria-label="Contenido completo del prompt"
            readOnly
            value={selected.content}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-52 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-5 text-slate-800"
          />
          <p className="mt-1 text-[11px] text-slate-500">Si el navegador impide copiar automáticamente, seleccioná el texto de este campo y copialo manualmente.</p>
        </SurfaceCard> : null}
        <p className="text-[11px] text-slate-500">La biblioteca es de consulta y copia. El alta, edición y eliminación de prompts se incorporarán en una etapa posterior.</p>
      </div>
    </PageShell>
  );
}
