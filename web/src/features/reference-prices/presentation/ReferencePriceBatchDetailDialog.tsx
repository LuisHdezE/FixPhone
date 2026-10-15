import { useEffect, useRef, useState } from 'react';
import {
  getReferencePriceImport, type ImportBatchDetail, type ImportedObservation,
} from '../infrastructure/referencePriceImportGateway';

const outline = 'h-7 rounded-md border border-slate-200 px-2 text-[11px] font-semibold hover:bg-slate-50';
const money = (row: ImportedObservation) =>
  (Number(row.price_minor) / 10 ** row.minor_digits).toFixed(row.minor_digits) + ' ' + row.currency;

export function ReferencePriceBatchDetailDialog({ batchId, onClose }: {
  batchId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    let alive = true;
    getReferencePriceImport(batchId)
      .then((result) => { if (alive) setDetail(result); })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : 'No se pudo consultar este lote.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [batchId]);

  return <dialog ref={dialogRef} onClose={onClose}
    aria-label="Detalle de importación"
    className="fixed inset-0 m-auto max-h-[90dvh] w-[min(96vw,760px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50">
    <div className="grid min-w-0 gap-2 p-3">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <h2 className="text-sm font-bold">Detalle de importación</h2>
        <button type="button" className={outline} onClick={() => dialogRef.current?.close()}
          aria-label="Cerrar detalle">Cerrar</button>
      </div>
      {loading ? <p className="text-xs text-slate-500">Cargando lote…</p> : null}
      {error ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{error}</p> : null}
      {detail ? <>
        <p className="break-all font-mono text-[11px]">{detail.batch.file_name}</p>
        <p className="text-[11px] text-slate-500">Confirmado: {detail.batch.committed_at?.slice(0, 16).replace('T', ' ')}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            ['Filas', detail.batch.total_rows],
            ['Nuevas', detail.batch.inserted_rows],
            ['Duplicadas', detail.batch.duplicate_rows],
          ] as const).map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="text-base font-semibold tabular-nums">{value}</p>
          </div>)}
        </div>
        {detail.batch.duplicate_rows > 0 ?
          <p className="text-[11px] text-slate-600">Las filas duplicadas no se guardan otra vez: sus precios siguen vinculados a la importación original.</p> : null}
        <h3 className="text-xs font-semibold">Observaciones nuevas de este lote</h3>
        {detail.rows.length === 0 ? <p className="text-xs text-slate-500">Este lote no agregó nuevos precios.</p> : null}
        <div className="grid max-h-[42dvh] gap-1.5 overflow-y-auto">
          {detail.rows.map((row, i) => <div key={i} className="min-w-0 rounded-md border border-slate-200 p-2">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5 text-xs">
              <div className="font-semibold">{row.model} · {row.service_name}</div>
              <div className="font-semibold tabular-nums">{money(row)}</div>
            </div>
            <div className="mt-1 text-[11px] text-slate-600">
              {row.source} · {row.source_country} · {row.observed_date} · {row.price_type === 'published_estimate' ? 'Estimado' : 'Precio publicado'}
            </div>
            {row.notes ? <p className="mt-1 break-words text-[11px] text-slate-600">{row.notes}</p> : null}
            <a href={row.source_url} target="_blank" rel="noopener noreferrer"
              className="mt-1 inline-block break-all text-[11px] text-blue-700 underline">Abrir fuente</a>
          </div>)}
        </div>
        {detail.batch.inserted_rows > detail.rows_limit ?
          <p className="text-[11px] text-slate-500">Se muestran solo las primeras {detail.rows_limit} observaciones de este lote.</p> : null}
      </> : null}
    </div>
  </dialog>;
}
