import { useEffect, useRef, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { AppIcon } from '@/components/AppIcon';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField, type SelectFieldOption } from '@/components/forms/SelectField';
import { apiInventoryRepository } from './apiInventoryRepository';
import type {
  InventoryDataState, InventoryEdit, InventoryFilter, InventoryHealth,
  InventoryHealthFilter, InventoryItem, InventoryRepository, StockAdjustment,
} from './inventory.types';

const labels: Record<InventoryHealth, string> = {
  healthy: 'Saludable',
  reorder: 'Reponer pronto',
  'out-of-stock': 'Agotado',
  available: 'En stock (sin mínimo)',
};
const tones: Record<InventoryHealth, StatusBadgeTone> = {
  healthy: 'success', reorder: 'warning', 'out-of-stock': 'neutral', available: 'info',
};
const options: readonly SelectFieldOption<InventoryHealthFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'En stock (sin mínimo)' },
  { value: 'healthy', label: 'Saludable' },
  { value: 'reorder', label: 'Reponer pronto' },
  { value: 'out-of-stock', label: 'Agotado' },
];
const initialFilter: InventoryFilter = { search: '', health: 'all' };
type Action = 'detail' | 'edit' | 'adjust' | 'history';
type Selection = { item: InventoryItem; action: Action };
const adjustableTypes = new Set(['spare_part', 'accessory', 'service_part']);

function IconAction({ icon, label, disabled = false, onClick }: {
  icon: 'search' | 'edit' | 'package' | 'document';
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <button
    aria-label={label}
    className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-40"
    disabled={disabled}
    onClick={onClick}
    title={label}
    type="button"
  ><AppIcon className="size-3.5" name={icon} /></button>;
}

export function InventoryView({ repository = apiInventoryRepository }: { repository?: InventoryRepository }) {
  const [filter, setFilter] = useState(initialFilter);
  const [state, setState] = useState<InventoryDataState>({ status: 'loading' });
  const [refreshToken, setRefreshToken] = useState(0);
  const [permissions, setPermissions] = useState<readonly string[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [edit, setEdit] = useState<InventoryEdit>({ title: '', description: '', brand: '', model: '' });
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState('');
  const [history, setHistory] = useState<readonly StockAdjustment[]>([]);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const canEdit = permissions.includes('catalog.manage');
  const canAdjust = permissions.includes('inventory.adjust');

  useEffect(() => {
    let active = true;
    void adminFetch('/api/v1/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron consultar los permisos.');
        return response.json() as Promise<{ data?: { permissions?: string[] } }>;
      })
      .then((payload) => { if (active) setPermissions(Array.isArray(payload.data?.permissions) ? payload.data.permissions : []); })
      .catch(() => { if (active) setPermissions([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    repository.list(filter)
      .then((next) => { if (active) setState(next); })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo consultar el inventario real.' });
      });
    return () => { active = false; };
  }, [filter, refreshToken, repository]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selection && dialog && !dialog.open) dialog.showModal();
    if (!selection && dialog?.open) dialog.close();
  }, [selection]);

  function open(item: InventoryItem, action: Action) {
    setSelection({ item, action });
    setEdit({ title: item.productName, description: item.description, brand: item.brand, model: item.model });
    setDelta('');
    setReason('');
    setRequestId(crypto.randomUUID());
    setModalError(null);
    setHistory([]);
    if (action === 'history') {
      void repository.adjustments(item.id).then(setHistory).catch((error: unknown) => {
        setModalError(error instanceof Error ? error.message : 'No se pudo consultar el historial.');
      });
    }
  }

  function close() {
    if (busy) return;
    dialogRef.current?.close();
    setSelection(null);
  }

  function changeAction(action: Action) {
    if (!selection) return;
    const item = selection.item;
    close();
    // Open on the next interaction with the same dialog element.
    setSelection({ item, action });
    setModalError(null);
    if (action === 'history') {
      void repository.adjustments(item.id).then(setHistory).catch((error: unknown) => {
        setModalError(error instanceof Error ? error.message : 'No se pudo consultar el historial.');
      });
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || busy) return;
    setBusy(true);
    setModalError(null);
    const item = selection.item;
    try {
      if (selection.action === 'edit') {
        if (!canEdit) return;
        await repository.update(item.id, edit);
        setMessage(item.sku + ': datos del catálogo actualizados.');
      } else if (selection.action === 'adjust') {
        if (!canAdjust || !adjustableTypes.has(item.itemType)) return;
        const change = Number(delta);
        if (!Number.isSafeInteger(change) || change === 0) {
          throw new Error('Ingresá una variación entera distinta de cero.');
        }
        if (reason.trim().length < 10) {
          throw new Error('La justificación debe tener al menos 10 caracteres.');
        }
        if (!window.confirm('¿Confirmás ajustar ' + item.sku + ' en ' + change + ' unidades? La operación quedará auditada.')) return;
        await repository.adjust(item.id, change, reason.trim(), requestId);
        setMessage(item.sku + ': existencias ajustadas con trazabilidad.');
      } else {
        return;
      }
      close();
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  const columns: readonly DataTableColumn<InventoryItem>[] = [
    { id: 'product', header: 'Producto', className: 'min-w-48',
      cell: (item) => <div><p className="font-semibold text-slate-900">{item.productName}</p><p className="font-mono text-[10px] text-slate-500">{item.sku}</p></div> },
    { id: 'category', header: 'Categoría', cell: (item) => item.category },
    { id: 'stock', header: 'Existencias',
      cell: (item) => <div><p className="font-semibold text-slate-900">{item.stockQuantity} unidades</p>
        {item.reorderPoint !== null ? <p className="text-[10px] text-slate-500">Mínimo {item.reorderPoint}</p> : null}</div> },
    { id: 'health', header: 'Salud',
      cell: (item) => <StatusBadge label={labels[item.health]} tone={tones[item.health]} /> },
    { id: 'updated', header: 'Actualizado',
      cell: (item) => <span className="text-[11px] text-slate-500">{item.updatedAtLabel}</span> },
    { id: 'actions', header: 'Acciones', align: 'right',
      cell: (item) => <div className="flex items-center justify-end gap-1">
        <IconAction icon="search" label={'Ver detalle de ' + item.sku} onClick={() => open(item, 'detail')} />
        {canEdit ? <IconAction icon="edit" label={'Editar ' + item.sku} onClick={() => open(item, 'edit')} /> : null}
        {canAdjust && adjustableTypes.has(item.itemType)
          ? <IconAction icon="package" label={'Ajustar existencias de ' + item.sku} onClick={() => open(item, 'adjust')} />
          : null}
        <IconAction icon="document" label={'Historial de ajustes de ' + item.sku} onClick={() => open(item, 'history')} />
      </div> },
  ];

  const hasFilters = filter.search.trim().length > 0 || filter.health !== 'all';
  const item = selection?.item;

  return <div className="grid gap-3">
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">Control de existencias reales</p>
          <h3 className="text-base font-semibold text-slate-900">Inventario operativo</h3>
          <p className="text-xs text-slate-500">Artículos guardados en MySQL. Ajustes con motivo y auditoría, sin cambios de stock ocultos.</p>
        </div>
        {state.status === 'success' ? <span className="text-xs font-semibold text-slate-600">{state.total} artículos</span> : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <SearchField id="inventory-search" label="Buscar inventario" onChange={(search) => setFilter((v) => ({ ...v, search }))} placeholder="Producto, SKU o categoría" value={filter.search} />
        <SelectField id="inventory-health-filter" label="Salud" onChange={(health) => setFilter((v) => ({ ...v, health }))} options={options} value={filter.health} />
        <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40" disabled={!hasFilters} onClick={() => setFilter(initialFilter)} type="button">Limpiar</button>
      </div>
    </section>
    {message ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p> : null}
    {state.status === 'loading' || state.status === 'idle' ? <InlineFeedback title="Cargando inventario" message="Consultando los artículos reales." tone="info" /> : null}
    {state.status === 'error' ? <div className="grid gap-2"><InlineFeedback title="Error de inventario" message={state.message} tone="error" /><button className="w-fit text-xs underline" type="button" onClick={() => setRefreshToken((v) => v + 1)}>Reintentar</button></div> : null}
    {state.status === 'empty' ? <InlineFeedback title="Sin coincidencias" message={state.message} /> : null}
    {state.status === 'success' ? <DataTable caption="Inventario operativo real" columns={columns} getRowId={(row) => row.id} rows={state.items} initialPageSize={10} pageSizeOptions={[10, 25, 50]} /> : null}

    <dialog aria-label={item ? selection?.action === 'adjust' ? 'Ajustar ' + item.sku : 'Inventario ' + item.sku : 'Detalle del inventario'}
      className="w-[min(94vw,600px)] rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-950/50"
      onClose={() => { if (!busy) setSelection(null); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      ref={dialogRef}>
      {item && selection ? <div className="p-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
          <div><h3 className="text-sm font-bold text-slate-900">{item.productName}</h3><p className="font-mono text-[11px] text-slate-500">{item.sku}</p></div>
          <button className="text-xs font-semibold text-slate-600" disabled={busy} onClick={close} type="button" aria-label="Cerrar ventana">Cerrar ✕</button>
        </div>

        {selection.action === 'detail' ? <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ['Tipo', item.category], ['Marca', item.brand || 'Sin registrar'], ['Modelo', item.model || 'Sin registrar'],
            ['Existencias', String(item.stockQuantity)], ['Mínimo', item.reorderPoint === null ? 'Sin definir' : String(item.reorderPoint)],
            ['Estado', item.operationalStatus], ['Destino', item.inventoryPurpose], ['Publicación inventario', item.publicationStatus],
          ].map(([title, value]) => <div key={title}><p className="font-semibold text-slate-500">{title}</p><p className="break-words text-slate-900">{value}</p></div>)}
          <div className="col-span-2"><p className="font-semibold text-slate-500">Descripción</p><p className="whitespace-pre-wrap text-slate-800">{item.description || 'Sin descripción'}</p></div>
        </div> : null}

        {selection.action === 'edit' ? <form className="mt-3 grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-1 text-xs font-semibold">Nombre del artículo<input autoFocus className="rounded-md border border-slate-300 p-2 text-sm" maxLength={255} onChange={(e) => setEdit((v) => ({ ...v, title: e.target.value }))} required value={edit.title} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold">Marca<input className="rounded-md border border-slate-300 p-2 text-sm" maxLength={150} onChange={(e) => setEdit((v) => ({ ...v, brand: e.target.value }))} value={edit.brand ?? ''} /></label>
            <label className="grid gap-1 text-xs font-semibold">Modelo<input className="rounded-md border border-slate-300 p-2 text-sm" maxLength={150} onChange={(e) => setEdit((v) => ({ ...v, model: e.target.value }))} value={edit.model ?? ''} /></label>
          </div>
          <label className="grid gap-1 text-xs font-semibold">Descripción<textarea className="rounded-md border border-slate-300 p-2 text-sm" maxLength={4000} onChange={(e) => setEdit((v) => ({ ...v, description: e.target.value }))} rows={3} value={edit.description ?? ''} /></label>
          <p className="text-[11px] text-slate-500">Esta edición no modifica SKU, costos, publicación ni cantidad.</p>
          <button className="rounded-md bg-brand-600 p-2 text-xs font-bold text-white disabled:opacity-40" disabled={busy || !edit.title.trim()} type="submit">Guardar cambios</button>
        </form> : null}

        {selection.action === 'adjust' ? <form className="mt-3 grid gap-3" onSubmit={(event) => void save(event)}>
          <p className="text-xs text-slate-600">Stock actual: <strong>{item.stockQuantity}</strong>. El ajuste será registrado con fecha, usuario y motivo. No usar para teléfonos físicos.</p>
          <label className="grid gap-1 text-xs font-semibold">Variación (+ entrada, - salida)
            <input autoFocus className="rounded-md border border-slate-300 p-2 text-sm" inputMode="numeric" onChange={(e) => setDelta(e.target.value)} placeholder="Ej. +3 o -1" required type="number" step="1" value={delta} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">Motivo del ajuste
            <textarea className="rounded-md border border-slate-300 p-2 text-sm" maxLength={300} minLength={10} onChange={(e) => { setReason(e.target.value); setRequestId(crypto.randomUUID()); }} required rows={2} value={reason} />
          </label>
          <button className="rounded-md bg-brand-600 p-2 text-xs font-bold text-white disabled:opacity-40" disabled={busy || delta === '' || reason.trim().length < 10} type="submit">Confirmar ajuste</button>
        </form> : null}

        {selection.action === 'history' ? <div className="mt-3 text-xs">
          <h4 className="mb-2 font-bold text-slate-800">Últimos ajustes de stock</h4>
          {history.length === 0 && !modalError ? <p className="text-slate-500">No hay ajustes registrados todavía.</p> : null}
          {history.map((movement) => <div className="grid gap-1 border-b border-slate-100 py-2" key={movement.id}>
            <div className="flex justify-between gap-2"><strong>{movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta} unidades</strong><span>{movement.quantity_before} → {movement.quantity_after}</span></div>
            <p>{movement.reason}</p><p className="text-slate-500">{new Date(movement.created_at).toLocaleString('es-UY')}</p>
          </div>)}
        </div> : null}

        {modalError ? <p role="alert" className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{modalError}</p> : null}
      </div> : null}
    </dialog>
  </div>;
}
