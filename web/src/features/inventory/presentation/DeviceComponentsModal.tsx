import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';
import { StoreProductImageField } from '@/features/storefront/presentation/StoreProductImageField';
import type { InventoryDeviceListItemDto } from '../application/devices.dto';

import { recoveredPartCopy } from './recoveredPartCopy';

type PartType = { id: string; name: string; parentId?: string | null };
type PartCondition = 'untested' | 'functional' | 'faulty';
type Row = { selected: boolean; condition: PartCondition; price: string; image: string; publish: boolean; variant: string; title: string | null; description: string | null };
type Sheet = { donor_sku: string; brand: string; model: string; exhausted: boolean; types: PartType[]; extracted: { part_type_id: string; part_name: string }[] };

async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
  if (!response.ok) throw new Error(body?.errors ? Object.values(body.errors).flat().join(' ') : body?.message || 'No se pudo completar la solicitud.');
  return body as T;
}

export function DeviceComponentsModal({ device, canPublish, onClose, onSaved }: {
  device: InventoryDeviceListItemDto; canPublish: boolean; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [currency, setCurrency] = useState('UYU');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const locked = busy || uploading;
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    void adminFetch('/api/v1/admin/devices/' + encodeURIComponent(device.inventoryId) + '/components', { cache: 'no-store' })
      .then(response => read<{ data: Sheet }>(response)).then(payload => {
        if (!alive) return;
        setSheet(payload.data);
        setRows(Object.fromEntries(payload.data.types.map(type => [type.id, { selected: false, condition: 'untested', price: '', image: '', publish: false, variant: '', title: null, description: null }])));
      }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la planilla.'); });
    return () => { alive = false; };
  }, [device.inventoryId, reload]);

  function path(id: string): string[] {
    const result: string[] = [];
    while (id && !result.includes(id)) {
      result.push(id);
      id = sheet?.types.find(type => type.id === id)?.parentId ?? '';
    }
    return result;
  }
  function conflict(a: string, b: string) {
    const left = path(a); const right = path(b);
    return a === b || left.includes(b) || right.includes(a) || (left.includes('part-display') && right.includes('part-display')) || (left.includes('part-charge-port') && right.includes('part-charge-port'));
  }
  const selected = Object.entries(rows).filter(([, row]) => row.selected);
  function change(id: string, patch: Partial<Row>) {
    setRows(current => ({ ...current, [id]: { ...current[id]!, ...patch } }));
    setRequestId(crypto.randomUUID());
    setError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked || selected.length === 0 || sheet?.exhausted) return;
    setBusy(true); setError(null);
    try {
      const components = selected.map(([type_id, row]) => {
        const number = row.price.trim() ? Number(row.price.replace(',', '.')) : null;
        const minor = number === null ? null : Math.round(number * 100);
        if (minor !== null && (!Number.isSafeInteger(minor) || minor <= 0 || minor > 2147483647)) throw new Error('Indicá precios válidos mayores que cero.');
        if (row.publish && (row.condition !== 'functional' || minor === null)) throw new Error('Cada pieza a publicar necesita condición funcional y precio.');
        const copy = recoveredPartCopy(sheet?.types.find(type => type.id === type_id)?.name ?? '', sheet?.brand ?? '', sheet?.model ?? '', row.variant);
        return { type_id, variant: row.variant, title: row.title ?? copy.title, description: row.description ?? copy.description, condition: row.condition, sale_price_minor: minor, image_url: row.image.trim() || null, publish: row.publish };
      });
      const payload = await read<{ data: { items: { created: boolean }[]; replayed: boolean } }>(await adminFetch('/api/v1/admin/devices/' + encodeURIComponent(device.inventoryId) + '/components', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_id: requestId, currency, components }),
      }));
      const created = payload.data.items.filter(item => item.created).length;
      onSaved(device.id + ': ' + payload.data.items.length + ' piezas ingresadas (+1 cada una), ' + created + ' repuestos nuevos y ' + (payload.data.items.length - created) + ' existentes actualizados.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el despiece.'); }
    finally { setBusy(false); }
  }

  return <ModalShell title={'Extraer componentes · ' + device.id} onClose={onClose} density="compact" width="medium" hideCloseButton disabled={locked}>
    <form onSubmit={event => void submit(event)} className="grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">{sheet ? sheet.brand + ' ' + sheet.model : device.manufacturer + ' ' + device.model}</p>
        <label className="flex items-center gap-2 text-xs">Moneda<select className="h-7 rounded border border-slate-200 px-2" value={currency} disabled={busy} onChange={event => { setCurrency(event.target.value); setRequestId(crypto.randomUUID()); }}><option>UYU</option><option>USD</option></select></label>
      </div>
      <p className="text-[11px] leading-4 text-slate-600">Seleccioná las piezas recuperadas de este equipo. Cada una ingresa con cantidad 1. Completá la variante si cambia color, marco o conjunto. Al sumar a un repuesto existente se conservan sus textos. Publicar requiere pieza funcional y precio.</p>
      {!sheet && !error ? <p role="status" className="text-xs">Cargando planilla…</p> : null}
      {sheet?.exhausted ? <p role="alert" className="text-xs text-amber-700">Este donante está agotado y no admite nuevas extracciones.</p> : null}
      {sheet && sheet.types.length === 0 ? <p className="text-xs text-amber-700">Agregá tipos de repuesto activos en el catálogo maestro.</p> : null}
      {sheet ? <div className="max-h-[48dvh] overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-2">Componente</th><th className="p-2">Condición</th><th className="p-2">Precio</th>{canPublish ? <th className="p-2">Publicar</th> : null}</tr></thead><tbody>
          {sheet.types.map(type => {
            const row = rows[type.id]; if (!row) return null;
            const extracted = sheet.extracted.some(item => conflict(type.id, item.part_type_id));
            const overlaps = selected.some(([id]) => id !== type.id && conflict(type.id, id));
            const disabled = busy || extracted || overlaps || sheet.exhausted;
            const copy = recoveredPartCopy(type.name, sheet.brand, sheet.model, row.variant);
            return <Fragment key={type.id}><tr className="border-t border-slate-100 align-top" key={type.id}>
              <td className="p-2"><label className="flex items-center gap-2"><input type="checkbox" checked={row.selected} disabled={disabled} onChange={event => change(type.id, { selected: event.target.checked })} /><span>{type.name}{extracted ? <small className="block text-emerald-700">Ya registrado</small> : null}</span></label>
</td>
              <td className="p-2"><select aria-label={'Condición de ' + type.name} className="h-7 max-w-32 rounded border border-slate-200 px-1" disabled={!row.selected || disabled} value={row.condition} onChange={event => change(type.id, { condition: event.target.value as PartCondition, publish: false })}><option value="untested">Sin probar</option><option value="functional">Funcional</option><option value="faulty">Con fallas</option></select></td>
              <td className="p-2"><input aria-label={'Precio de ' + type.name} className="h-7 w-24 rounded border border-slate-200 px-2" disabled={!row.selected || disabled} inputMode="decimal" placeholder="0,00" value={row.price} onChange={event => change(type.id, { price: event.target.value })} /></td>
              {canPublish ? <td className="p-2 text-center"><input aria-label={'Publicar ' + type.name} type="checkbox" checked={row.publish} disabled={!row.selected || disabled || row.condition !== 'functional'} onChange={event => change(type.id, { publish: event.target.checked })} /></td> : null}
            </tr>{row.selected ? <tr className="bg-slate-50/60"><td colSpan={canPublish ? 4 : 3} className="px-2 pb-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">Variante / características<input aria-label={'Variante de ' + type.name} className="h-7 rounded border border-slate-200 px-2" placeholder="Ej.: negro, con marco, flex completo" maxLength={120} disabled={busy} value={row.variant} onChange={event => change(type.id, { variant: event.target.value })} /></label>
                <label className="grid gap-1">Título<input aria-label={'Título de ' + type.name} className="h-7 rounded border border-slate-200 px-2" maxLength={255} required disabled={busy} value={row.title ?? copy.title} onChange={event => change(type.id, { title: event.target.value })} /></label>
                <label className="grid gap-1 sm:col-span-2">Descripción<textarea aria-label={'Descripción de ' + type.name} className="rounded border border-slate-200 px-2 py-1" rows={2} maxLength={2000} disabled={busy} value={row.description ?? copy.description} onChange={event => change(type.id, { description: event.target.value })} /></label>
                <StoreProductImageField value={row.image} onChange={image => change(type.id, { image: image ?? '' })} disabled={locked} onUploadingChange={setUploading} productLabel={type.name} />
                <button type="button" className="justify-self-start text-slate-600 underline" disabled={busy} onClick={() => change(type.id, { title: null, description: null })}>Restaurar textos automáticos</button>
              </div>
            </td></tr> : null}</Fragment>;
          })}
        </tbody></table>
      </div> : null}
      {error ? <div role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">{error}{!sheet ? <button className="ml-2 underline" type="button" onClick={() => setReload(value => value + 1)}>Reintentar</button> : null}</div> : null}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs"><span>{selected.length} piezas · +{selected.length} unidades</span><div className="flex gap-2"><button className="h-7 rounded border border-slate-200 px-3" type="button" disabled={locked} onClick={onClose}>Cancelar</button><button className="h-7 rounded bg-brand-600 px-3 text-white disabled:opacity-40" type="submit" disabled={locked || !sheet || sheet.exhausted || selected.length === 0} aria-busy={locked}>{uploading ? 'Subiendo imagen…' : 'Guardar'}</button></div></div>
    </form>
  </ModalShell>;
}
