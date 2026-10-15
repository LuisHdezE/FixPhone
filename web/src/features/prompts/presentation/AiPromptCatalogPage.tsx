import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  archiveAiPrompt, createAiPrompt, getAiPrompt, getAiPromptHistory,
  listAiPrompts, reactivateAiPrompt, restoreAiPromptRevision, updateAiPrompt,
  type AiPromptDetail, type AiPromptInput, type AiPromptRevision, type AiPromptSummary,
} from '../infrastructure/aiPromptCatalogGateway';

type Modal =
  | { kind: 'create' }
  | { kind: 'edit' | 'view' | 'archive' | 'reactivate' | 'history'; prompt: AiPromptDetail };
const emptyForm: AiPromptInput = { code: '', description: '', content: '' };
const field = 'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[var(--theme-primary)]';
const smallButton = 'inline-flex h-7 items-center justify-center rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const action = 'grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40';

function ActionButton({ name, icon, onClick, disabled = false }: {
  name: string; icon: AppIconName; onClick: () => void; disabled?: boolean;
}) {
  return <button type="button" aria-label={name} title={name} disabled={disabled}
    className={action} onClick={onClick}><AppIcon className="size-3.5" name={icon} /></button>;
}
function explanation(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export function AiPromptCatalogPage() {
  const [prompts, setPrompts] = useState<AiPromptSummary[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [form, setForm] = useState<AiPromptInput>(emptyForm);
  const [history, setHistory] = useState<AiPromptRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const requestRef = useRef(0);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es');
    return prompts.filter((prompt) =>
      (showArchived || !prompt.archived_at) &&
      (prompt.code.toLocaleLowerCase('es').includes(needle) ||
        prompt.description.toLocaleLowerCase('es').includes(needle)),
    );
  }, [prompts, search, showArchived]);

  async function refresh() {
    const result = await listAiPrompts();
    setPrompts(result.data);
    setCanManage(result.can_manage);
  }
  useEffect(() => {
    let live = true;
    listAiPrompts().then((result) => {
      if (live) { setPrompts(result.data); setCanManage(result.can_manage); }
    }).catch((reason: unknown) => { if (live) setError(explanation(reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (modal && !element.open) element.showModal();
    if (!modal && element.open) element.close();
  }, [modal]);

  function closeModal() {
    if (busy) return;
    requestRef.current += 1;
    setModal(null);
    setHistory([]);
    setError('');
  }
  function startCreate() {
    setForm(emptyForm); setError(''); setNotice(''); setModal({ kind: 'create' });
  }
  async function selectPrompt(code: string, kind: 'view' | 'edit' | 'archive' | 'reactivate' | 'history' | 'copy') {
    const token = ++requestRef.current;
    setBusyCode(code); setError(''); setNotice('');
    try {
      const prompt = await getAiPrompt(code);
      if (token !== requestRef.current) return;
      if (kind === 'copy') {
        setModal({ kind: 'view', prompt });
        await copyPrompt(prompt.content, code);
        return;
      }
      if (kind === 'edit') setForm({ code: prompt.code, description: prompt.description, content: prompt.content });
      if (kind === 'history') {
        const revisions = await getAiPromptHistory(code);
        if (token !== requestRef.current) return;
        setHistory(revisions);
      }
      setModal({ kind, prompt });
    } catch (reason) {
      if (token === requestRef.current) setError(explanation(reason));
    } finally {
      if (token === requestRef.current) setBusyCode(null);
    }
  }
  async function copyPrompt(content: string, code: string) {
    try {
      await navigator.clipboard.writeText(content);
      setNotice('Prompt ' + code + ' copiado. Ya podés pegarlo en ChatGPT.');
      setError('');
    } catch {
      setError('No se pudo copiar automáticamente. Abrí el contenido y seleccionalo manualmente.');
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !modal || (modal.kind !== 'create' && modal.kind !== 'edit')) return;
    setBusy(true); setError('');
    try {
      const description = form.description.trim();
      if (!description || !form.content.trim()) throw new Error('Completá la descripción y el contenido.');
      const result = modal.kind === 'create'
        ? await createAiPrompt({ ...form, code: form.code.trim().toUpperCase(), description })
        : await updateAiPrompt(modal.prompt.code, { description, content: form.content }, modal.prompt.version);
      await refresh();
      setModal(null);
      setNotice('Prompt ' + result.code + (result.version === 1 ? ' creado.' : ' actualizado.'));
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  }
  async function confirmStateChange() {
    if (!modal || busy || (modal.kind !== 'archive' && modal.kind !== 'reactivate')) return;
    setBusy(true); setError('');
    try {
      const result = modal.kind === 'archive'
        ? await archiveAiPrompt(modal.prompt.code, modal.prompt.version)
        : await reactivateAiPrompt(modal.prompt.code, modal.prompt.version);
      await refresh(); setModal(null);
      setNotice('Prompt ' + result.code + (modal.kind === 'archive' ? ' archivado sin perder el historial.' : ' reactivado.'));
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  }
  async function restoreRevision(version: number) {
    if (!modal || modal.kind !== 'history' || busy) return;
    setBusy(true); setError('');
    try {
      const result = await restoreAiPromptRevision(modal.prompt.code, version, modal.prompt.version);
      await refresh(); setModal(null);
      setNotice('Recuperada la versión ' + version + ' de ' + result.code + '. La recuperación quedó registrada como una nueva versión.');
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  }

  const editing = modal?.kind === 'edit';
  const formOpen = modal?.kind === 'create' || editing;

  return <PageShell title="Biblioteca de prompts"
    description="Catálogo de instrucciones reutilizables, con copia rápida, edición y versiones."
    breadcrumbs={[{ label: 'Administración' }, { label: 'Prompts de IA' }]}>
    <div className="grid gap-2" data-ai-prompts>
      {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{notice}</p> : null}
      {error && !modal ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">{error}</p> : null}
      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Buscar prompts" className={field + ' w-full min-w-32 flex-1 sm:max-w-xs'}
            placeholder="Buscar código o descripción…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="flex items-center gap-1 text-[11px] text-slate-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Incluir archivados
          </label>
          {canManage ? <button type="button" className="ml-auto h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white"
            onClick={startCreate}>+ Nuevo prompt</button> : null}
        </div>
        {loading ? <p className="mt-2 text-xs text-slate-500">Cargando…</p> : null}
        {!loading && filtered.length === 0 ? <p className="mt-2 text-xs text-slate-500">No hay prompts para mostrar.</p> : null}
        {filtered.length > 0 ? <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead><tr className="border-b text-slate-500">
              <th className="px-2 py-1.5">Código</th>
              <th className="px-2 py-1.5">Descripción</th>
              <th className="px-2 py-1.5">Versión</th>
              <th className="px-2 py-1.5 text-right">Acciones</th>
            </tr></thead>
            <tbody>{filtered.map((prompt) => <tr key={prompt.code} className="border-b border-slate-100">
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">{prompt.code}</td>
              <td className="px-2 py-1.5">{prompt.description}
                {prompt.archived_at ? <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">Archivado</span> : null}
              </td>
              <td className="px-2 py-1.5 tabular-nums">v{prompt.version}</td>
              <td className="px-2 py-1">
                <div className="flex justify-end gap-1">
                  <ActionButton icon="search" name={'Ver ' + prompt.code} disabled={busyCode !== null || busy}
                    onClick={() => void selectPrompt(prompt.code, 'view')} />
                  {!prompt.archived_at ? <ActionButton icon="document" name={'Copiar ' + prompt.code}
                    disabled={busyCode !== null || busy} onClick={() => void selectPrompt(prompt.code, 'copy')} /> : null}
                  {canManage ? <>
                    {!prompt.archived_at ? <>
                      <ActionButton icon="edit" name={'Editar ' + prompt.code} disabled={busyCode !== null || busy}
                        onClick={() => void selectPrompt(prompt.code, 'edit')} />
                      <ActionButton icon="trash" name={'Archivar ' + prompt.code} disabled={busyCode !== null || busy}
                        onClick={() => void selectPrompt(prompt.code, 'archive')} />
                    </> : <ActionButton icon="check-circle" name={'Reactivar ' + prompt.code} disabled={busyCode !== null || busy}
                      onClick={() => void selectPrompt(prompt.code, 'reactivate')} />}
                    <ActionButton icon="book" name={'Historial ' + prompt.code} disabled={busyCode !== null || busy}
                      onClick={() => void selectPrompt(prompt.code, 'history')} />
                  </> : null}
                </div>
              </td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </SurfaceCard>
      <p className="text-[11px] text-slate-500">Archivar no borra contenido ni versiones. Los cambios se registran en auditoría. El código no se modifica después del alta.</p>
    </div>
    <dialog ref={dialogRef} onCancel={(e) => { if (busy) e.preventDefault(); else closeModal(); }}
      onClose={() => { if (!busy) setModal(null); }}
      aria-label="Operación de biblioteca de prompts"
      className="fixed inset-0 m-auto w-[min(96vw,720px)] max-h-[90dvh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-950/50">
      {modal ? <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold">
            {modal.kind === 'create' ? 'Nuevo prompt' :
              modal.kind === 'edit' ? 'Editar prompt' :
              modal.kind === 'view' ? 'Contenido del prompt' :
              modal.kind === 'history' ? 'Historial de versiones' :
              modal.kind === 'archive' ? 'Archivar prompt' : 'Reactivar prompt'}
          </h2>
          <button type="button" aria-label="Cerrar modal" disabled={busy} className={action} onClick={closeModal}>
            <AppIcon name="x" className="size-4" />
          </button>
        </div>
        {error ? <p role="alert" className="mb-2 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{error}</p> : null}
        {formOpen ? <form onSubmit={(e) => void save(e)} className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <label className="grid gap-0.5 text-[11px] font-semibold">Código
              <input className={field + ' font-mono'} required maxLength={80}
                pattern="[A-Z][A-Z0-9_]{2,79}" disabled={editing} value={form.code}
                onChange={(e) => setForm((previous) => ({ ...previous, code: e.target.value.toUpperCase() }))} />
            </label>
            <label className="grid gap-0.5 text-[11px] font-semibold">Descripción
              <input className={field} required maxLength={255} value={form.description}
                onChange={(e) => setForm((previous) => ({ ...previous, description: e.target.value }))} />
            </label>
          </div>
          <label className="grid gap-0.5 text-[11px] font-semibold">Contenido del prompt
            <textarea required maxLength={100000} value={form.content}
              onChange={(e) => setForm((previous) => ({ ...previous, content: e.target.value }))}
              className="h-[min(38dvh,340px)] min-h-40 w-full resize-y rounded-md border border-slate-200 p-2 font-mono text-xs leading-5 outline-none focus:border-[var(--theme-primary)]" />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
            <button className={smallButton} type="button" onClick={closeModal}>Cancelar</button>
            <button className="h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
              type="submit" disabled={busy || !form.description.trim() || !form.content.trim() || !form.code.trim()}>
              {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear prompt'}
            </button>
          </div>
        </form> : null}
        {modal.kind === 'view' ? <div className="grid gap-2">
          <p className="text-xs font-semibold">{modal.prompt.code} · {modal.prompt.description}</p>
          <textarea readOnly aria-label="Contenido completo del prompt" onFocus={(e) => e.currentTarget.select()}
            value={modal.prompt.content}
            className="h-[min(52dvh,480px)] min-h-40 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs leading-5" />
          <div className="flex justify-end gap-2">
            <button type="button" className={smallButton} onClick={closeModal}>Cerrar</button>
            <button type="button" className="h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white"
              onClick={() => void copyPrompt(modal.prompt.content, modal.prompt.code)}>Copiar al portapapeles</button>
          </div>
          <p className="text-[11px] text-slate-500">Si el navegador bloquea la copia, seleccioná el texto y copialo manualmente.</p>
        </div> : null}
        {modal.kind === 'archive' || modal.kind === 'reactivate' ? <div className="grid gap-2">
          <p className="text-xs">{modal.kind === 'archive'
            ? '¿Archivar ' + modal.prompt.code + '? Ya no aparecerá en la lista activa. Sus versiones quedarán conservadas.'
            : '¿Reactivar ' + modal.prompt.code + '? Volverá a aparecer entre los prompts activos.'}</p>
          <div className="flex justify-end gap-2">
            <button className={smallButton} type="button" onClick={closeModal}>Cancelar</button>
            <button className="h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
              type="button" disabled={busy} onClick={() => void confirmStateChange()}>{busy ? 'Guardando…' : 'Confirmar'}</button>
          </div>
        </div> : null}
        {modal.kind === 'history' ? <div className="grid gap-2">
          <p className="text-xs font-semibold">{modal.prompt.code} · versión actual v{modal.prompt.version}</p>
          <div className="max-h-[52dvh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="p-1.5">Versión</th><th className="p-1.5">Acción</th>
                <th className="p-1.5">Fecha</th><th className="p-1.5 text-right">Acción</th></tr></thead>
              <tbody>{history.map((revision) => <tr key={revision.version} className="border-b border-slate-100">
                <td className="p-1.5">v{revision.version}</td><td className="p-1.5">{revision.action}</td>
                <td className="p-1.5">{revision.created_at?.slice(0, 19).replace('T', ' ')}</td>
                <td className="p-1.5 text-right">{revision.version !== modal.prompt.version && !modal.prompt.archived_at ?
                  <button className={smallButton} type="button" disabled={busy}
                    onClick={() => void restoreRevision(revision.version)}>Recuperar</button> : null}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">Recuperar una versión crea una nueva revisión y conserva el historial. No modifica el código.</p>
        </div> : null}
      </div> : null}
    </dialog>
  </PageShell>;
}
