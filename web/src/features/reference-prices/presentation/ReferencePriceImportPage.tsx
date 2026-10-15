import { useEffect, useRef, useState } from 'react';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  confirmReferencePrices, listReferencePriceImports, previewReferencePrices,
  REFERENCE_PRICE_HEADER,
  type ImportedBatch, type ImportPreview,
} from '../infrastructure/referencePriceImportGateway';

const button = 'h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = 'h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50';
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'No se pudo completar la importación.';

export function ReferencePriceImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [history, setHistory] = useState<ImportedBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    let alive = true;
    listReferencePriceImports().then((items) => { if (alive) setHistory(items); })
      .catch((cause: unknown) => { if (alive) setError(errorText(cause)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog.open) dialog.close();
  }, [dialogOpen]);

  async function load(file: File) {
    setError(''); setNotice(''); setModalError(''); setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1024 * 1024) {
        throw new Error('Elegí un archivo .csv de hasta 1 MB.');
      }
      const result = await previewReferencePrices(file);
      setFileName(file.name);
      setPreview(result);
      setDialogOpen(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function closeDialog() {
    if (busy) return;
    setDialogOpen(false); setPreview(null); setModalError('');
  }
  async function confirm() {
    if (!preview?.valid || !preview.batch_id || busy) return;
    setModalError(''); setBusy(true);
    try {
      const result = await confirmReferencePrices(preview.batch_id);
      const current = await listReferencePriceImports();
      setHistory(current);
      setDialogOpen(false); setPreview(null);
      setNotice(result.already_confirmed
        ? 'Este lote ya estaba confirmado. No se duplicaron observaciones.'
        : 'Importación guardada: ' + result.inserted + ' precios nuevos y ' + result.duplicate + ' duplicados omitidos.');
    } catch (cause) {
      setModalError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  function downloadTemplate() {
    const file = new Blob(['\uFEFF' + REFERENCE_PRICE_HEADER + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fixphone_plantilla_precios_referencia.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <PageShell
    title="Precios de referencia"
    description="Importá tarifas verificadas de Apple y MundoMac. Primero validamos el CSV, luego confirmás el guardado."
    breadcrumbs={[{ label: 'Administración' }, { label: 'Precios de referencia' }]}>
    <div className="grid gap-3" data-reference-prices-import>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800" role="status">{notice}</p> : null}
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Importar precios de reparación</h2>
            <p className="mt-0.5 text-[11px] text-slate-600">Generá el archivo con el prompt PRICE_REF_001, descargalo y seleccioná el CSV aquí.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={button} onClick={downloadTemplate}>Plantilla CSV</button>
            <button type="button" className={primary} disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? 'Validando…' : 'Seleccionar CSV'}
            </button>
          </div>
          <input ref={fileInput} className="hidden" aria-label="Seleccionar archivo CSV" type="file" accept=".csv,text/csv"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); }} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Admite hasta 2.000 filas y 1 MB. No modifica inventario ni presupuestos. No convierte monedas ni consulta fuentes automáticamente.
          La validación comprueba formato y consistencia, no certifica que el precio esté publicado.
        </p>
      </SurfaceCard>
      <SurfaceCard>
        <h2 className="text-sm font-bold text-slate-900">Historial de importaciones confirmadas</h2>
        {loading ? <p className="mt-2 text-xs text-slate-500">Cargando…</p> : null}
        {!loading && history.length === 0 ? <p className="mt-2 text-xs text-slate-500">Todavía no hay importaciones.</p> : null}
        {history.length > 0 ? <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead><tr className="border-b text-slate-500">
              <th className="px-2 py-1.5">Archivo</th><th className="px-2 py-1.5">Fecha</th>
              <th className="px-2 py-1.5 text-right">Filas</th><th className="px-2 py-1.5 text-right">Nuevas</th>
              <th className="px-2 py-1.5 text-right">Duplicadas</th>
            </tr></thead>
            <tbody>{history.map((item) => <tr key={item.id} className="border-b border-slate-100">
              <td className="max-w-[260px] truncate px-2 py-1.5" title={item.file_name}>{item.file_name}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{item.committed_at?.slice(0, 16).replace('T', ' ')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{item.total_rows}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{item.inserted_rows}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{item.duplicate_rows}</td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </SurfaceCard>
    </div>
    <dialog ref={dialogRef} aria-label="Vista previa de importación de precios"
      onCancel={(event) => { if (busy) event.preventDefault(); else closeDialog(); }}
      onClose={() => { if (!busy) setDialogOpen(false); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(96vw,860px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/50">
      {preview ? <div className="grid gap-2 p-3">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-bold">{preview.valid ? 'Vista previa lista para confirmar' : 'CSV con errores'}</h2>
            <p className="max-w-[640px] break-all text-[11px] text-slate-500">{fileName}</p>
          </div>
          <button aria-label="Cerrar" type="button" className={button + ' px-2'} disabled={busy} onClick={closeDialog}>✕</button>
        </div>
        {modalError ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{modalError}</p> : null}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            ['Filas', preview.summary.total], ['Nuevas', preview.summary.new],
            ['Duplicadas', preview.summary.duplicate], ['Errores', preview.summary.errors],
          ].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>)}
        </div>
        {preview.errors.length > 0 ? <div className="max-h-36 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 p-2">
          <h3 className="text-xs font-semibold text-rose-800">Errores detectados. Corregí el CSV antes de continuar.</h3>
          {preview.errors.map((item, index) => <p key={index} className="mt-1 text-[11px] text-rose-900">
            Fila {item.row}: {item.message}
          </p>)}
          {preview.summary.errors > preview.errors.length ? <p className="text-[11px]">Se muestran los primeros 30 errores.</p> : null}
        </div> : null}
        {preview.preview.length > 0 ? <div className="max-h-[34dvh] overflow-y-auto">
          <table className="w-full min-w-[520px] text-left text-[11px]">
            <thead className="sticky top-0 bg-white"><tr className="border-b text-slate-500">
              <th className="p-1.5">Fuente</th><th className="p-1.5">Modelo</th><th className="p-1.5">Servicio</th>
              <th className="p-1.5">Fecha</th><th className="p-1.5 text-right">Importe</th><th className="p-1.5">Estado</th>
            </tr></thead>
            <tbody>{preview.preview.map((item, index) => <tr className="border-b border-slate-100" key={index}>
              <td className="p-1.5">{item.source}</td><td className="p-1.5">{item.model}</td>
              <td className="p-1.5">{item.service_name}</td><td className="p-1.5">{item.observed_date}</td>
              <td className="whitespace-nowrap p-1.5 text-right tabular-nums">{item.price_amount} {item.currency}</td>
              <td className="p-1.5">{item.status === 'new' ? 'Nueva' : 'Duplicada'}</td>
            </tr>)}</tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">Vista de las primeras 20 filas únicas. Los duplicados y los datos pueden cambiar si alguien importa otro archivo antes de confirmar.</p>
        </div> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-2">
          <button type="button" className={button} disabled={busy} onClick={closeDialog}>Cancelar</button>
          <button type="button" className={primary} disabled={busy || !preview.valid || !preview.batch_id}
            onClick={() => void confirm()}>{busy ? 'Guardando…' : 'Confirmar importación'}</button>
        </div>
      </div> : null}
    </dialog>
  </PageShell>;
}
