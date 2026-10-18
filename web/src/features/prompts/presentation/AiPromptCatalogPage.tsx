import { SuccessToast } from '@/components/feedback/SuccessToast';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  archiveAiPrompt, createAiPrompt, createAiPromptVersion, getAiPrompt, getAiPromptHistory,
  listAiPrompts, reactivateAiPrompt, restoreAiPromptRevision, updateAiPrompt,
  type AiPromptDetail, type AiPromptRevision, type AiPromptSummary,
} from '../infrastructure/aiPromptCatalogGateway';

type Modal =
  | { kind: 'create' }
  | { kind: 'edit' | 'new_version' | 'view' | 'archive' | 'reactivate' | 'history'; prompt: AiPromptDetail };

type FormState = {
  description: string;
  version: string;
  content: string;
};

const emptyForm: FormState = { description: '', version: '1.0', content: '' };
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
  const [form, setForm] = useState<FormState>(emptyForm);
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
        prompt.description.toLocaleLowerCase('es').includes(needle) ||
        prompt.version.toLocaleLowerCase('es').includes(needle)),
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

  async function selectPrompt(code: string, kind: 'view' | 'edit' | 'new_version' | 'archive' | 'reactivate' | 'history' | 'copy') {
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
      if (kind === 'edit') setForm({ description: prompt.description, version: prompt.version || '1.0', content: prompt.content });
      if (kind === 'new_version') setForm({ description: prompt.description, version: '', content: prompt.content });
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
    if (busy || !modal || (modal.kind !== 'create' && modal.kind !== 'edit' && modal.kind !== 'new_version')) return;
    setBusy(true); setError('');
    try {
      const description = form.description.trim();
      const content = form.content.trim();
      if (!description || !content) throw new Error('Completá la descripción y el contenido.');
      let result: AiPromptDetail;
      if (modal.kind === 'create') {
        const version = form.version.trim() || '1.0';
        result = await createAiPrompt({ description, content: form.content, version });
      } else if (modal.kind === 'new_version') {
        const version = form.version.trim();
        if (!version) throw new Error('Ingresá el número de la nueva versión.');
        result = await createAiPromptVersion(
          modal.prompt.code,
          { description, content: form.content, version },
          modal.prompt.lock_version,
        );
      } else {
        result = await updateAiPrompt(
          modal.prompt.code,
          { description, content: form.content },
          modal.prompt.lock_version,
        );
      }
      await refresh();
      setModal(null);
      setNotice(
        modal.kind === 'create'
          ? 'Prompt ' + result.code + ' creado (v' + result.version + ').'
          : modal.kind === 'new_version'
          ? 'Nueva versión v' + result.version + ' creada para ' + result.code + '.'
          : 'Prompt ' + result.code + ' actualizado (v' + result.version + ').'
      );
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  }

  async function confirmStateChange() {
    if (!modal || busy || (modal.kind !== 'archive' && modal.kind !== 'reactivate')) return;
    setBusy(true); setError('');
    try {
      const result = modal.kind === 'archive'
        ? await archiveAiPrompt(modal.prompt.code, modal.prompt.lock_version)
        : await reactivateAiPrompt(modal.prompt.code, modal.prompt.lock_version);
      await refresh(); setModal(null);
      setNotice('Prompt ' + result.code + (modal.kind === 'archive' ? ' archivado sin perder el historial.' : ' reactivado.'));
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  }

  async function restoreRevision(version: number) {
    if (!modal || modal.kind !== 'history' || busy) return;
    setBusy(true); setError('');
    try {
      const result = await restoreAiPromptRevision(modal.prompt.code, version, modal.prompt.lock_version);
      await refresh(); setModal(null);
      setNotice('Recuperada la versión ' + version + ' de ' + result.code + '. La recuperación quedó registrada como una nueva versión.');
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  }

  const editing = modal?.kind === 'edit';
  const isNewVersion = modal?.kind === 'new_version';
  const formOpen = modal?.kind === 'create' || editing || isNewVersion;

  return <PageShell title="Biblioteca de prompts"
    description="Catálogo de instrucciones reutilizables, con copia rápida, edición y versiones."
    breadcrumbs={[{ label: 'Administración' }, { label: 'Prompts de IA' }]}>
    <div className="grid gap-2" data-ai-prompts>
      <SuccessToast message={notice} />
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
          <table className="w-full min-w-[460px] text-left text-xs">
            <thead><tr className="border-b text-slate-500">
              <th className="px-2 py-1.5 font-medium">Código</th>
              <th className="px-2 py-1.5 font-medium">Descripción</th>
              <th className="px-2 py-1.5 font-medium">Versión</th>
              <th className="px-2 py-1.5 font-medium">Estado</th>
              <th className="px-2 py-1.5 text-right font-medium">Acciones</th>
            </tr></thead>
            <tbody>{filtered.map((prompt) => <tr key={prompt.code} className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px] font-semibold text-slate-700">{prompt.code}</td>
              <td className="px-2 py-1.5 text-slate-800">{prompt.description}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-600">v{prompt.version}</td>
              <td className="whitespace-nowrap px-2 py-1.5">
                {prompt.archived_at ? (
                  <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    Archivado
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded border border-emerald-200/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    Activo
                  </span>
                )}
              </td>
              <td className="px-2 py-1">
                <div className="flex justify-end gap-1">
                  <ActionButton icon="search" name={'Ver ' + prompt.code} disabled={busyCode !== null || busy}
                    onClick={() => void selectPrompt(prompt.code, 'view')} />
                  {!prompt.archived_at ? <ActionButton icon="document" name={'Copiar ' + prompt.code}
                    disabled={busyCode !== null || busy} onClick={() => void selectPrompt(prompt.code, 'copy')} /> : null}
                  {canManage ? <>
                    {!prompt.archived_at ? <>
                      <ActionButton icon="tag" name={'Nueva versión de ' + prompt.code} disabled={busyCode !== null || busy}
                        onClick={() => void selectPrompt(prompt.code, 'new_version')} />
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
      <p className="text-[11px] text-slate-500">Los códigos se generan automáticamente (PROMPT-xxxx). Archivar no borra contenido ni versiones. Los cambios se registran en auditoría.</p>
    </div>
    <dialog ref={dialogRef} onCancel={(e) => { if (busy) e.preventDefault(); else closeModal(); }}
      onClose={() => { if (!busy) setModal(null); }}
      aria-label="Operación de biblioteca de prompts"
      className="fixed inset-0 m-auto w-[min(96vw,720px)] max-h-[90dvh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-950/50">
      {modal ? <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold">
            {modal.kind === 'create' ? 'Nuevo prompt' :
              modal.kind === 'new_version' ? 'Nueva versión de ' + modal.prompt.code :
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
        <SuccessToast message={notice} />
        {formOpen ? <form onSubmit={(e) => void save(e)} className="grid gap-2">
          {isNewVersion ? (
            <div className="grid gap-2">
              <div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-800">
                Se conservará la versión actual (v{modal.prompt.version}) en el historial. La nueva versión debe ser numéricamente superior (ej. 2.0).
              </div>
              <div className="grid gap-2 sm:grid-cols-[120px_100px_100px]">
                <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Código
                  <input className={field + ' font-mono bg-slate-100 text-slate-500 cursor-not-allowed'}
                    disabled value={modal.prompt.code} readOnly title="El código es inmutable" />
                </label>
                <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Versión actual
                  <input className={field + ' font-mono bg-slate-100 text-slate-500 cursor-not-allowed'}
                    disabled value={'v' + modal.prompt.version} readOnly title="Versión actualmente vigente" />
                </label>
                <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Nueva versión
                  <input className={field} required maxLength={20} value={form.version} placeholder="Ej. 2.0"
                    onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} autoFocus />
                </label>
              </div>
              <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Descripción
                <input className={field} required maxLength={255} value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
            </div>
          ) : editing ? (
            <div className="grid gap-2 sm:grid-cols-[140px_1fr_100px]">
              <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Código
                <input className={field + ' font-mono bg-slate-100 text-slate-500 cursor-not-allowed'}
                  disabled value={modal.prompt.code} readOnly title="El código es inmutable" />
              </label>
              <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Descripción
                <input className={field} required maxLength={255} value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Versión
                <input className={field + ' font-mono bg-slate-100 text-slate-500 cursor-not-allowed'}
                  disabled value={'v' + modal.prompt.version} readOnly title="La versión no se modifica al editar. Usá 'Nueva versión'." />
              </label>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-slate-700">Código</span>
                <span className="font-mono text-[11px] text-slate-500">Se generará automáticamente (PROMPT-xxxx)</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
                <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Descripción
                  <input className={field} required maxLength={255} placeholder="Ej. Publicidad de dispositivo FixPhone"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
                <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Versión
                  <input className={field} required maxLength={20} value={form.version} placeholder="1.0"
                    onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} />
                </label>
              </div>
            </div>
          )}
          <label className="grid gap-0.5 text-[11px] font-semibold text-slate-700">Contenido del prompt
            <textarea required maxLength={100000} value={form.content}
              onChange={(e) => setForm((previous) => ({ ...previous, content: e.target.value }))}
              className="h-[min(38dvh,340px)] min-h-40 w-full resize-y rounded-md border border-slate-200 p-2 font-mono text-xs leading-5 outline-none focus:border-[var(--theme-primary)]" />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
            <button className={smallButton} type="button" onClick={closeModal}>Cancelar</button>
            <button className="h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
              type="submit" disabled={busy || !form.description.trim() || !form.content.trim() || (isNewVersion && !form.version.trim())}>
              {busy ? 'Guardando…' : isNewVersion ? 'Guardar nueva versión' : editing ? 'Guardar cambios' : 'Crear prompt'}
            </button>
          </div>
        </form> : null}
        {modal.kind === 'view' ? <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-xs font-semibold">{modal.prompt.code} · {modal.prompt.description}</p>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">v{modal.prompt.version}</span>
          </div>
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
              <thead><tr className="border-b text-slate-500"><th className="p-1.5">Revisión</th><th className="p-1.5">Versión</th><th className="p-1.5">Acción</th>
                <th className="p-1.5">Fecha</th><th className="p-1.5 text-right">Acción</th></tr></thead>
              <tbody>{history.map((revision) => <tr key={revision.version} className="border-b border-slate-100">
                <td className="p-1.5">rev #{revision.version}</td>
                <td className="p-1.5 font-mono">{revision.prompt_version ? 'v' + revision.prompt_version : '—'}</td>
                <td className="p-1.5">{revision.action}</td>
                <td className="p-1.5">{revision.created_at?.slice(0, 19).replace('T', ' ')}</td>
                <td className="p-1.5 text-right">{revision.version !== modal.prompt.lock_version && !modal.prompt.archived_at ?
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
