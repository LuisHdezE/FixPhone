import { useEffect, useState, type FormEvent } from 'react';
import { editableTechnicalFields as fields, technicalSpecsPayload } from '../application/technicalSpecs';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';
import type { MasterDataDeviceModelDto, MasterDataRamCapacityDto, MasterDataStorageCapacityDto } from '../application/master-data.dto';

type Specs = { specs_json: Record<string, unknown>; source_type: string; status: string } | null;
type Variant = { id: string; name: string; variant_key: string; ram_capacity_id: string | null; storage_capacity_id: string | null; active: boolean };
type ModelDetails = { data: { specifications: Specs; variants: Variant[] } };
type VariantForm = { id?: string; name: string; variant_key: string; ram_capacity_id: string; storage_capacity_id: string; active: boolean };

async function readApi<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = payload as { message?: string; errors?: Record<string, string[]> };
    throw new Error(Object.values(error.errors ?? {}).flat().join(' ') || error.message || 'No se pudo completar la operación.');
  }
  return payload as T;
}



export function DeviceModelTechnicalModal({
  model, ram, storage, onClose,
}: {
  model: MasterDataDeviceModelDto;
  ram: readonly MasterDataRamCapacityDto[];
  storage: readonly MasterDataStorageCapacityDto[];
  onClose: () => void;
}) {
  const [specs, setSpecs] = useState<Record<string, unknown>>({});
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variant, setVariant] = useState<VariantForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const base = `/api/v1/admin/device-models/${encodeURIComponent(model.id)}`;

  useEffect(() => {
    let alive = true;
    adminFetch(base + '/technical').then(readApi<ModelDetails>).then(({ data }) => {
      if (!alive) return;
      const raw = data.specifications?.specs_json ?? {};
      if (typeof raw !== 'object' || raw === null || (Array.isArray(raw) && raw.length > 0) || !Array.isArray(data.variants)) {
        throw new Error('La ficha recibida no tiene un formato válido. Volvé a abrirla para reintentar.');
      }
      setSpecs(raw);
      setVariants(data.variants);
      setLoaded(true);
    }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la ficha.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [base]);

  async function saveSpecs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || loading || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await readApi(await adminFetch(base + '/technical', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs_json: technicalSpecsPayload(specs), source_type: 'manual' }),
      }));
      setNotice('Ficha técnica guardada como borrador.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variant || !loaded || loading || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await readApi<{ data: Variant }>(await adminFetch(base + '/variants' + (variant.id ? '/' + encodeURIComponent(variant.id) : ''), {
        method: variant.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: variant.name.trim(), variant_key: variant.variant_key.trim().toLowerCase(),
          ram_capacity_id: variant.ram_capacity_id || null,
          storage_capacity_id: variant.storage_capacity_id || null,
          active: variant.active,
        }),
      }));
      setVariants((old) => variant.id ? old.map((v) => v.id === result.data.id ? result.data : v) : [...old, result.data]);
      setVariant(null); setNotice('Variante guardada.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }

  const inputClass = 'w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-800';
  return <ModalShell title={`Ficha técnica · ${model.name}`} onClose={onClose} disabled={saving} density="compact" width="medium">
    <div className="max-h-[75vh] space-y-3 overflow-y-auto p-3 text-xs" data-device-model-technical>
      {loading ? <p role="status">Cargando ficha...</p> : <>
        {error && <p role="alert" className="rounded bg-rose-50 p-2 text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded bg-emerald-50 p-2 text-emerald-700">{notice}</p>}
        {loaded && <><form onSubmit={(event) => void saveSpecs(event)} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Características comunes del modelo</h3>
            <span className="text-amber-700">Borrador, sin publicación automática</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fields.map(([key, label]) => <label key={key} className="space-y-1"><span>{label}</span><input className={inputClass} value={typeof specs[key] === 'string' ? specs[key] : ''} onChange={(event) => setSpecs((old) => ({ ...old, [key]: event.target.value }))} /></label>)}
          </div>
          <div className="flex justify-end"><button disabled={saving} className="rounded bg-[var(--theme-primary)] px-3 py-1.5 font-semibold text-white disabled:opacity-50">Guardar ficha</button></div>
        </form>
        <div className="border-t border-slate-200 pt-3">
          <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Variantes comerciales</h3><button className="rounded border px-2 py-1" type="button" disabled={saving} onClick={() => setVariant({ name: '', variant_key: '', ram_capacity_id: '', storage_capacity_id: '', active: true })}>Añadir variante</button></div>
          <div className="space-y-1">{variants.map((v) => <div key={v.id} className="flex items-center justify-between rounded border px-2 py-1"><span>{v.name} · {v.active ? 'Activa' : 'Inactiva'}</span><button className="rounded border px-2 py-1" type="button" disabled={saving} onClick={() => setVariant({ ...v, ram_capacity_id: v.ram_capacity_id ?? '', storage_capacity_id: v.storage_capacity_id ?? '' })}>Editar</button></div>)}{variants.length === 0 && <p className="text-slate-500">Sin variantes registradas.</p>}</div>
          {variant && <form onSubmit={(event) => void saveVariant(event)} className="mt-2 grid grid-cols-1 gap-2 rounded bg-slate-50 p-2 sm:grid-cols-2">
            <label>Nombre<input required className={inputClass} value={variant.name} onChange={(e) => setVariant((v) => v && { ...v, name: e.target.value })}/></label>
            <label>Clave (ej. 8gb-128gb)<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={variant.variant_key} onChange={(e) => setVariant((v) => v && { ...v, variant_key: e.target.value })}/></label>
            <label>RAM<select className={inputClass} value={variant.ram_capacity_id} onChange={(e) => setVariant((v) => v && { ...v, ram_capacity_id: e.target.value })}><option value="">Sin especificar</option>{ram.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Almacenamiento<select className={inputClass} value={variant.storage_capacity_id} onChange={(e) => setVariant((v) => v && { ...v, storage_capacity_id: e.target.value })}><option value="">Sin especificar</option>{storage.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={variant.active} onChange={(e) => setVariant((v) => v && { ...v, active: e.target.checked })}/>Activa</label>
            <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setVariant(null)}>Cancelar</button><button disabled={saving} className="rounded bg-[var(--theme-primary)] px-3 py-1 text-white">Guardar variante</button></div>
          </form>}
        </div></>}
      </>}
    </div>
  </ModalShell>;
}
