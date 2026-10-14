import { useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  technicalChecks, technicalResultLabels, overallResultLabels,
  type TechnicalCheck, type TechnicalCheckResult, type TechnicalEvaluation,
} from '../application/technical-evaluations';
import { apiDeviceTechnicalEvaluationGateway } from '../infrastructure/ApiDeviceTechnicalEvaluationGateway';

function EvaluationSummary({ evaluation }: { evaluation: TechnicalEvaluation }) {
  return <div className="grid gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-semibold text-slate-900">Revisión #{evaluation.revision} · {overallResultLabels[evaluation.overall_result]}</p>
        <p className="text-[11px] text-slate-500">
          {evaluation.technician_name} · {new Date(evaluation.created_at).toLocaleString('es-UY')}
        </p>
      </div>
      <span className="text-[11px] font-medium text-slate-500">Historial inmutable</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {technicalChecks.map(check => {
        const result = evaluation.checks.find(item => item.check_key === check.key);
        const state = result?.result ?? 'not_tested';
        return <div className="rounded-md border border-slate-200 px-3 py-2" key={check.key}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800">{check.label}</span>
            <span className={state === 'fault' ? 'font-semibold text-red-700' : state === 'ok' ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
              {technicalResultLabels[state]}
            </span>
          </div>
          {result?.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{result.notes}</p> : null}
        </div>;
      })}
    </div>
    {evaluation.notes ? <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">Observaciones: {evaluation.notes}</p> : null}
  </div>;
}

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600';

function EvaluationEntryModal({ inventoryId, onClose, onSaved }: {
  inventoryId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [checks, setChecks] = useState<TechnicalCheck[]>(
    () => technicalChecks.map(check => ({ key: check.key, result: 'not_tested', notes: '' })),
  );
  const [notes, setNotes] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasResults = checks.some(check => check.result !== 'not_tested');

  function change(index: number, patch: Partial<TechnicalCheck>) {
    setChecks(current => current.map((check, i) => i === index ? { ...check, ...patch } : check));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !hasResults) return;
    setBusy(true);
    setError(null);
    try {
      await apiDeviceTechnicalEvaluationGateway.create(inventoryId, {
        request_id: requestId, checks, notes,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar el diagnóstico.');
    } finally {
      setBusy(false);
    }
  }

  return <ModalShell title="Registrar evaluación técnica" onClose={onClose} disabled={busy}>
    <form className="grid gap-3 p-4" onSubmit={event => void submit(event)}>
      <p className="text-xs text-slate-600">
        Registrá los resultados verificados. «Sin probar» no significa correcto.
        El diagnóstico guardado será inmutable; las correcciones se registran como una nueva revisión.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {technicalChecks.map((item, i) => <div className="grid gap-2 rounded-md border border-slate-200 p-2" key={item.key}>
          <label className="grid gap-1 text-xs font-semibold text-slate-800">
            {item.label}
            <select className={inputClass} value={checks[i].result}
              onChange={event => change(i, { result: event.target.value as TechnicalCheckResult })}>
              <option value="not_tested">Sin probar</option>
              <option value="ok">Correcto</option>
              <option value="fault">Con falla</option>
              <option value="not_applicable">No aplica</option>
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-slate-600">
            Nota de esta prueba (opcional)
            <input className={inputClass} maxLength={800} placeholder="Resultado observado"
              value={checks[i].notes} onChange={event => change(i, { notes: event.target.value })}/>
          </label>
        </div>)}
      </div>
      <label className="grid gap-1 text-xs font-semibold text-slate-700">
        Observaciones generales (opcional)
        <textarea className={inputClass} rows={2} maxLength={3000} value={notes}
          onChange={event => setNotes(event.target.value)}/>
      </label>
      {!hasResults ? <p className="text-xs text-amber-700">Seleccioná un resultado en al menos una prueba para guardar.</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"
          disabled={busy} onClick={onClose} type="button">Cancelar</button>
        <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          disabled={busy || !hasResults} type="submit">{busy ? 'Guardando…' : 'Registrar diagnóstico'}</button>
      </div>
    </form>
  </ModalShell>;
}

export function TechnicalEvaluationPanel({ inventoryId }: { inventoryId: string }) {
  const [evaluations, setEvaluations] = useState<readonly TechnicalEvaluation[]>([]);
  const [canDiagnose, setCanDiagnose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiDeviceTechnicalEvaluationGateway.list(inventoryId),
      adminFetch('/api/v1/auth/me', { cache: 'no-store' }),
    ]).then(async ([history, me]) => {
      if (!me.ok) throw new Error('No se pudieron verificar los permisos de diagnóstico.');
      const payload = await me.json() as { data?: { permissions?: string[] } };
      if (!active) return;
      setEvaluations(history);
      setCanDiagnose((payload.data?.permissions ?? []).includes('diagnosis.manage'));
      setError(null);
    }).catch(cause => {
      if (active) {
        setCanDiagnose(false);
        setError(cause instanceof Error ? cause.message : 'No fue posible cargar las evaluaciones.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inventoryId, reloadVersion]);

  function saved() {
    setShowModal(false);
    setNotice('Evaluación registrada. El historial anterior se mantiene sin cambios.');
    setReloadVersion(version => version + 1);
  }

  return <SurfaceCard>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">Evaluación técnica e historial</h3>
        <p className="mt-1 text-xs text-slate-500">Pruebas verificadas y persistidas para este equipo.</p>
      </div>
      {canDiagnose ? <button className="h-8 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white"
        onClick={() => setShowModal(true)} type="button">Registrar diagnóstico</button> : null}
    </div>
    {notice ? <p className="mt-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800" role="status">{notice}</p> : null}
    {loading ? <p className="mt-3 text-xs text-slate-500">Cargando historial de evaluaciones…</p> : null}
    {error ? <div className="mt-3 grid gap-2">
      <p className="text-xs text-red-700" role="alert">{error}</p>
      <button className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-xs"
        onClick={() => setReloadVersion(version => version + 1)} type="button">Reintentar</button>
    </div> : null}
    {!loading && !error && evaluations.length === 0 ? <div className="mt-3 grid gap-2">
      <p className="text-xs text-slate-600">Aún no hay diagnósticos registrados. Ningún resultado se presume correcto.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {technicalChecks.map(check => <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs" key={check.key}>
          <span className="text-slate-700">{check.label}</span><span className="text-slate-500">Sin registrar</span>
        </div>)}
      </div>
    </div> : null}
    {!loading && !error && evaluations.length > 0 ? <div className="mt-3 grid gap-3">
      <EvaluationSummary evaluation={evaluations[0]}/>
      {evaluations.length > 1 ? <details className="rounded-md border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-800">Ver {evaluations.length - 1} revisiones anteriores</summary>
        <div className="mt-3 grid gap-4">
          {evaluations.slice(1).map(evaluation => <div className="border-t border-slate-100 pt-3" key={evaluation.id}>
            <EvaluationSummary evaluation={evaluation}/>
          </div>)}
        </div>
      </details> : null}
    </div> : null}
    {showModal ? <EvaluationEntryModal inventoryId={inventoryId} onClose={() => setShowModal(false)} onSaved={saved}/> : null}
  </SurfaceCard>;
}
