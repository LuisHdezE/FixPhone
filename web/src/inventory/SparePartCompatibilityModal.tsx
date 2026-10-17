import { useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';

type ModelEntry = { id: string; name: string; brandId?: string; active: boolean };
type BrandEntry = { id: string; name: string; active: boolean };
type Compatibility = { sku: string; title: string; device_model_ids: string[]; legacy_model_id: string | null; locked_identity: boolean };
export function SparePartCompatibilityModal({ id, onClose, onSaved }: {
  id: string; onClose: () => void; onSaved: () => void;
}) {
  const [part, setPart] = useState<Compatibility | null>(null);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [brands, setBrands] = useState<BrandEntry[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      adminFetch('/api/v1/admin/inventory/spare-parts/' + encodeURIComponent(id) + '/compatibilities', { cache: 'no-store' }),
      adminFetch('/api/v1/admin/master-data', { cache: 'no-store' }),
    ]).then(async ([a, b]) => {
      if (!a.ok || !b.ok) throw new Error('No se pudieron cargar los modelos.');
      return Promise.all([a.json(), b.json()]) as Promise<[{ data: Compatibility }, { data: { brands: BrandEntry[]; deviceModels: ModelEntry[] } }]>;
    }).then(([a, b]) => {
      if (!active) return;
      setPart(a.data); setIds(a.data.device_model_ids);
      setBrands(b.data.brands.filter(x => x.active));
      setModels(b.data.deviceModels.filter(x => x.active));
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Error de carga.'); });
    return () => { active = false; };
  }, [id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!part || !ids.length || reason.trim().length < 10 || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await adminFetch('/api/v1/admin/inventory/spare-parts/' + encodeURIComponent(id) + '/compatibilities', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ device_model_ids: ids, reason: reason.trim() }),
      });
      const data = await r.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
      if (!r.ok) throw new Error(data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'No se pudieron guardar las compatibilidades.');
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de guardado.'); }
    finally { setBusy(false); }
  }
  const normalized = search.trim().toLocaleLowerCase('es');
  const visible = models.filter(m => !normalized || (m.name + ' ' + (brands.find(b => b.id === m.brandId)?.name ?? '')).toLocaleLowerCase('es').includes(normalized));
  return <ModalShell title={'Modelos compatibles · ' + (part?.sku ?? '')} density="compact" onClose={onClose} disabled={busy}>
    <form className="grid min-w-0 gap-2 p-3 text-xs" onSubmit={event => void save(event)}>
      <p className="font-semibold">{part?.title ?? 'Cargando…'}</p>
      <p className="text-slate-600">Seleccioná solamente modelos con compatibilidad técnica confirmada. No se modifica el inventario.</p>
      <label className="grid gap-1">Buscar modelo
        <input className="h-8 w-full min-w-0 rounded border px-2" value={search} onChange={e => setSearch(e.target.value)} placeholder="Marca o modelo…" />
      </label>
      <div className="max-h-52 overflow-y-auto rounded border p-2" role="group" aria-label="Modelos compatibles">
        {visible.map(m => <label key={m.id} className="flex items-center gap-2 py-1">
          <input type="checkbox" checked={ids.includes(m.id)} disabled={part?.locked_identity && part.legacy_model_id === m.id}
            onChange={e => setIds(old => e.target.checked ? [...old, m.id] : old.filter(x => x !== m.id))} />
          <span>{brands.find(b => b.id === m.brandId)?.name ?? ''} {m.name}</span>
          {part?.legacy_model_id === m.id && part.locked_identity ? <span className="text-slate-500">(origen protegido)</span> : null}
        </label>)}
        {!visible.length ? <p className="text-slate-500">No hay modelos coincidentes.</p> : null}
      </div>
      <label className="grid gap-1">Motivo de la vinculación
        <textarea className="w-full min-w-0 rounded border p-2" required minLength={10} maxLength={300} rows={2}
          value={reason} onChange={e => setReason(e.target.value)} placeholder="Referencia técnica o comprobación de compatibilidad…" />
      </label>
      {error ? <p role="alert" className="rounded bg-red-50 p-2 text-red-700">{error}</p> : null}
      <div className="flex justify-end"><button disabled={busy || !part || !ids.length || reason.trim().length < 10}
        className="h-8 rounded bg-brand-600 px-3 font-semibold text-white disabled:opacity-50" type="submit">
        {busy ? 'Guardando…' : 'Guardar compatibilidades'}
      </button></div>
    </form>
  </ModalShell>;
}
