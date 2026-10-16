import { SuccessToast } from '@/components/feedback/SuccessToast';
import { useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { AppIcon } from '@/components/AppIcon';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField, type SelectFieldOption } from '@/components/forms/SelectField';
import { ModalShell } from '@/components/layout/ModalShell';
import { OrderFormModal } from './OrderFormModal';
import { apiOrdersRepository } from './apiOrdersRepository';
import { formatOrderMoney, type OrderStatus, type OrderStatusFilter, type OrderSummary, type OrdersRepository } from './orders.types';

const labels: Record<OrderStatus, string> = {
  pending: 'Pendiente', processing: 'Preparando', ready: 'Listo para entregar', cancelled: 'Cancelado',
};
const tones: Record<OrderStatus, StatusBadgeTone> = {
  pending: 'warning', processing: 'info', ready: 'success', cancelled: 'neutral',
};
const filterOptions: readonly SelectFieldOption<OrderStatusFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'processing', label: 'Preparando' },
  { value: 'ready', label: 'Listos' },
  { value: 'cancelled', label: 'Cancelados' },
];

type ModalState =
  | { kind: 'create' }
  | { kind: 'edit'; order: OrderSummary }
  | { kind: 'view'; order: OrderSummary }
  | { kind: 'cancel'; order: OrderSummary }
  | null;

const actionClass = 'grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40';

function OrderDetails({ order, onClose }: { order: OrderSummary; onClose: () => void }) {
  return <ModalShell title={'Pedido ' + order.number} onClose={onClose}>
    <div className="grid gap-3 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-semibold">{order.customer_name}</p><p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString('es-UY')}</p></div>
        <StatusBadge label={labels[order.status]} tone={tones[order.status]}/>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-2">Artículo</th><th className="px-2 py-2">Cantidad</th><th className="px-2 py-2">Precio unitario</th><th className="px-2 py-2 text-right">Total</th></tr></thead>
          <tbody>{order.items.map(item => <tr className="border-t border-slate-100" key={item.inventory_item_id}>
            <td className="px-2 py-2"><span className="font-semibold">{item.item_name_snapshot}</span><p className="text-slate-500">{item.item_sku_snapshot || 'Sin SKU'}</p></td>
            <td className="px-2 py-2">{item.quantity}</td>
            <td className="px-2 py-2">{formatOrderMoney(item.unit_price_minor, order.currency_code)}</td>
            <td className="px-2 py-2 text-right">{formatOrderMoney(item.line_total_minor, order.currency_code)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-right font-semibold">Total del pedido: {formatOrderMoney(order.total_amount_minor, order.currency_code)}</p>
      <p className="whitespace-pre-wrap text-xs text-slate-700">Notas: {order.notes || 'Sin notas.'}</p>
      {order.cancel_reason ? <p className="text-xs text-red-700">Motivo de cancelación: {order.cancel_reason}</p> : null}
      <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">El pedido no es una factura ni una venta liquidada. No modifica por sí solo el inventario físico ni los reportes financieros.</p>
    </div>
  </ModalShell>;
}

export function OrderListView({ repository = apiOrdersRepository }: { repository?: OrdersRepository }) {
  const [orders, setOrders] = useState<readonly OrderSummary[]>([]);
  const [filter, setFilter] = useState<{ search: string; status: OrderStatusFilter }>({ search: '', status: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([repository.list(), adminFetch('/api/v1/auth/me', { cache: 'no-store' })])
      .then(async ([records, me]) => {
        if (!me.ok) throw new Error('No se pudieron verificar los permisos de tu cuenta.');
        const result = await me.json() as { data?: { permissions?: string[] } };
        if (!active) return;
        setOrders(records);
        setCanManage((result.data?.permissions ?? []).includes('orders.manage'));
        setError(null);
      })
      .catch(cause => {
        if (active) { setCanManage(false); setError(cause instanceof Error ? cause.message : 'No fue posible consultar los pedidos.'); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, refresh]);

  const search = filter.search.trim().toLocaleLowerCase('es');
  const filtered = orders.filter(order =>
    (filter.status === 'all' || order.status === filter.status)
    && (!search || [order.number, order.customer_name].some(x => x.toLocaleLowerCase('es').includes(search)))
  );

  function saved(message: string) {
    setModal(null);
    setNotice(message);
    setActionError(null);
    setRefresh(n => n + 1);
  }

  async function transition(order: OrderSummary, status: 'processing' | 'ready' | 'cancelled', reason?: string) {
    if (busy || !canManage) return;
    if (status !== 'cancelled' && !window.confirm('¿Cambiar el pedido ' + order.number + ' a ' + labels[status] + '? Esta operación no registra una venta.')) return;
    setBusy(true);
    setActionError(null);
    try {
      await repository.changeStatus(order.id, status, reason);
      saved('Pedido ' + order.number + ' actualizado a ' + labels[status].toLowerCase() + '.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No se pudo cambiar el pedido.');
    } finally {
      setBusy(false);
    }
  }

  function cancelOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== 'cancel' || cancelReason.trim().length < 5) return;
    void transition(modal.order, 'cancelled', cancelReason.trim());
  }

  const columns: readonly DataTableColumn<OrderSummary>[] = [
    {
      id: 'order', header: 'Pedido', sortable: true,
      sortValue: order => order.number,
      cell: order => <div><p className="font-semibold text-slate-900">{order.number}</p><p className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleString('es-UY')}</p></div>,
    },
    { id: 'customer', header: 'Cliente', sortable: true, sortValue: order => order.customer_name,
      cell: order => <span className="font-medium text-slate-700">{order.customer_name}</span> },
    { id: 'items', header: 'Artículos', cell: order => order.items.reduce((sum, x) => sum + x.quantity, 0) },
    { id: 'status', header: 'Estado', cell: order => <StatusBadge label={labels[order.status]} tone={tones[order.status]}/> },
    { id: 'total', header: 'Total', align: 'right', cell: order => <span className="font-semibold text-slate-900">{formatOrderMoney(order.total_amount_minor, order.currency_code)}</span> },
    { id: 'actions', header: 'Acciones', align: 'right', cell: order => <div className="flex items-center justify-end gap-1">
      <button className={actionClass} aria-label={'Ver pedido ' + order.number} title="Ver detalle" onClick={() => setModal({ kind: 'view', order })} type="button"><AppIcon className="size-3.5" name="search"/></button>
      {canManage && order.status === 'pending' ? <button className={actionClass} aria-label={'Editar pedido ' + order.number} title="Editar pedido" onClick={() => setModal({ kind: 'edit', order })} type="button"><AppIcon className="size-3.5" name="edit"/></button> : null}
      {canManage && (order.status === 'pending' || order.status === 'processing') ? <button className={actionClass} disabled={busy} aria-label={'Avanzar pedido ' + order.number} title={order.status === 'pending' ? 'Iniciar preparación' : 'Marcar como listo'} onClick={() => void transition(order, order.status === 'pending' ? 'processing' : 'ready')} type="button"><AppIcon className="size-3.5" name="check-circle"/></button> : null}
      {canManage && order.status !== 'cancelled' ? <button className={actionClass + ' text-red-700 hover:bg-red-50'} disabled={busy} aria-label={'Cancelar pedido ' + order.number} title="Cancelar pedido" onClick={() => { setCancelReason(''); setModal({ kind: 'cancel', order }); }} type="button"><AppIcon className="size-3.5" name="x"/></button> : null}
    </div> },
  ];

  return <div className="grid gap-3">
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-brand-600">Ventas · Pedidos comerciales</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Pedidos</h3>
          <p className="mt-1 text-xs text-slate-500">Ventas de teléfonos y repuestos. Las órdenes de reparación se gestionan por separado.</p>
        </div>
        {canManage ? <button className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white" onClick={() => setModal({ kind: 'create' })} type="button">Registrar</button> : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <SearchField id="orders-search" label="Buscar pedidos" onChange={value => setFilter(f => ({ ...f, search: value }))} placeholder="Número o cliente" value={filter.search}/>
        <SelectField id="orders-status-filter" label="Estado del pedido" onChange={value => setFilter(f => ({ ...f, status: value }))} options={filterOptions} value={filter.status}/>
        <button className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={!search && filter.status === 'all'} onClick={() => setFilter({ search: '', status: 'all' })} type="button">Limpiar filtros</button>
      </div>
    </section>

    <SuccessToast message={notice} />
    {actionError ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{actionError}</p> : null}
    {loading ? <InlineFeedback title="Cargando pedidos" message="Consultando los pedidos persistidos en FixPhone." tone="info"/> : null}
    {!loading && error ? <div className="grid gap-2">
      <InlineFeedback title="No se pudo cargar Pedidos" message={error} tone="error"/>
      <button className="w-fit rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => setRefresh(n => n + 1)} type="button">Reintentar</button>
    </div> : null}
    {!loading && !error ? <DataTable caption="Pedidos comerciales reales" columns={columns} rows={filtered}
      getRowId={order => order.id} density="compact" paginationStyle="compact" initialPageSize={10} pageSizeOptions={[10,20,50]}
      emptyMessage={orders.length === 0 ? 'Todavía no hay pedidos reales registrados.' : 'No hay pedidos que coincidan con los filtros.'}/> : null}

    {modal?.kind === 'view' ? <OrderDetails order={modal.order} onClose={() => setModal(null)}/> : null}
    {modal?.kind === 'create' ? <OrderFormModal repository={repository} onSaved={saved} onClose={() => setModal(null)}/> : null}
    {modal?.kind === 'edit' ? <OrderFormModal order={modal.order} key={modal.order.id} repository={repository} onSaved={saved} onClose={() => setModal(null)}/> : null}
    {modal?.kind === 'cancel' ? <ModalShell title={'Cancelar ' + modal.order.number} onClose={() => { if (!busy) setModal(null); }} disabled={busy}>
      <form className="grid gap-3 p-4" onSubmit={cancelOrder}>
        <p className="text-xs text-slate-700">Indicá el motivo. El pedido se conservará para auditoría y liberará las cantidades comprometidas.</p>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Motivo de cancelación
          <textarea className="rounded-md border border-slate-300 p-2 text-sm" minLength={5} maxLength={300} required rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}/>
        </label>
        <div className="flex justify-end gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-xs" disabled={busy} onClick={() => setModal(null)} type="button">Volver</button>
          <button className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={busy || cancelReason.trim().length < 5} type="submit">Confirmar cancelación</button>
        </div>
      </form>
    </ModalShell> : null}
  </div>;
}
