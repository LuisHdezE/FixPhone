import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import { formatOrderMoney, type OrderCatalog, type OrderFormInput, type OrderSummary, type OrdersRepository } from './orders.types';

type Props = {
  order?: OrderSummary;
  repository: OrdersRepository;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type LineState = { inventory_item_id: string; quantity: number };
const fieldClass = 'grid gap-1 text-xs font-semibold text-slate-700';
const inputClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 disabled:bg-slate-50';

export function OrderFormModal({ order, repository, onClose, onSaved }: Props) {
  const [catalog, setCatalog] = useState<OrderCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(order?.customer_id ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<LineState[]>(
    () => order?.items.map(item => ({
      inventory_item_id: item.inventory_item_id, quantity: item.quantity,
    })) ?? [],
  );

  useEffect(() => {
    let active = true;
    repository.catalog(order?.id)
      .then(data => { if (active) setCatalog(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, order?.id]);

  const catalogItems = catalog?.items ?? [];
  const selected = useMemo(() => lines.map(line => {
    const item = catalogItems.find(option => option.id === line.inventory_item_id);
    return { line, item };
  }), [catalogItems, lines]);

  const currencyCodes = selected.map(({ item }) => item?.currency_code ?? '').filter(Boolean);
  const mixedCurrencies = new Set(currencyCodes).size > 1;
  const missingCatalogItems = selected.some(({ item }) => !item);
  const overStock = selected.some(({ line, item }) => item && (line.quantity > item.available_quantity || line.quantity < 1));
  const canSave = !loading && !busy && !!customerId && lines.length > 0
    && !mixedCurrencies && !missingCatalogItems && !overStock;

  const total = selected.reduce((sum, { item, line }) => sum + (item?.unit_price_minor ?? 0) * line.quantity, 0);
  const currency = currencyCodes[0] ?? 'UYU';

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  }
  function addLine() {
    const option = catalogItems.find(item => !lines.some(line => line.inventory_item_id === item.id));
    if (option) setLines(current => [...current, { inventory_item_id: option.id, quantity: 1 }]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    const input: OrderFormInput = { customer_id: customerId, notes, items: lines };
    try {
      if (order) {
        await repository.update(order.id, input);
        onSaved('Pedido actualizado correctamente.');
      } else {
        await repository.create(input);
        onSaved('Pedido comercial registrado correctamente.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el pedido.');
    } finally {
      setBusy(false);
    }
  }

  return <ModalShell title={order ? 'Editar pedido ' + order.number : 'Registrar pedido comercial'} onClose={onClose} disabled={busy}>
    <form className="grid gap-3 p-4" onSubmit={event => void submit(event)}>
      <p className="text-xs leading-5 text-slate-600">
        Este pedido compromete cantidades disponibles, pero no descuenta stock ni registra ventas o cobros.
        Los precios provienen del inventario real y se verifican al guardar.
      </p>
      {loading ? <p className="text-xs text-slate-500">Cargando clientes y artículos reales…</p> : null}
      {!loading && catalog ? <>
        <label className={fieldClass}>Cliente
          <select className={inputClass} required value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Seleccionar cliente</option>
            {catalog.customers.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select>
        </label>
        {catalog.customers.length === 0 ? <p className="text-xs font-medium text-amber-700">Todavía no hay clientes registrados. Creá un cliente en la vista Clientes antes de registrar pedidos.</p> : null}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Artículos del pedido</h3>
          <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={catalogItems.length <= lines.length || busy} onClick={addLine} type="button">Agregar artículo</button>
        </div>
        {catalogItems.length === 0 ? <p className="text-xs font-medium text-amber-700">No hay equipos o repuestos reales habilitados para venta con precio y stock disponibles.</p> : null}
        <div className="grid gap-2">
          {selected.map(({ line, item }, index) => <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto]" key={index}>
            <label className={fieldClass}>Artículo
              <select className={inputClass} value={line.inventory_item_id} onChange={e => updateLine(index, { inventory_item_id: e.target.value, quantity: 1 })}>
                {!item ? <option value={line.inventory_item_id}>Artículo anterior no disponible</option> : null}
                {catalogItems.filter(option => option.id === line.inventory_item_id || !lines.some((other, i) => i !== index && other.inventory_item_id === option.id))
                  .map(option => <option key={option.id} value={option.id}>{option.sku || 'Sin SKU'} · {option.title} · {formatOrderMoney(option.unit_price_minor, option.currency_code)} (disp. {option.available_quantity})</option>)}
              </select>
            </label>
            <label className={fieldClass}>Cantidad
              <input className={inputClass} min={1} max={item?.available_quantity ?? 1000} type="number" required value={line.quantity} onChange={e => updateLine(index, { quantity: Number(e.target.value) })}/>
            </label>
            <button className="self-end rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => setLines(current => current.filter((_, i) => i !== index))} type="button">Quitar</button>
          </div>)}
        </div>
        {mixedCurrencies ? <p className="text-xs text-red-700" role="alert">No se pueden combinar artículos de monedas diferentes.</p> : null}
        {missingCatalogItems ? <p className="text-xs text-red-700" role="alert">Un artículo ya no está disponible. Revisá el pedido antes de guardar.</p> : null}
        {overStock ? <p className="text-xs text-red-700" role="alert">La cantidad solicitada supera el stock disponible.</p> : null}
        <p className="text-right text-sm font-semibold text-slate-900">Total estimado: {formatOrderMoney(total, currency)}</p>
        <label className={fieldClass}>Notas comerciales
          <textarea className={inputClass} maxLength={4000} rows={2} value={notes} onChange={e => setNotes(e.target.value)}/>
        </label>
      </> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold" disabled={busy} onClick={onClose} type="button">Cancelar</button>
        <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={!canSave} type="submit">
          {busy ? 'Guardando…' : order ? 'Guardar cambios' : 'Registrar'}
        </button>
      </div>
    </form>
  </ModalShell>;
}
