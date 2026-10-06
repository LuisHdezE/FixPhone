import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField, type SelectFieldOption } from '@/components/forms/SelectField';
import { mockOrdersRepository } from '@/orders/mockOrdersRepository';
import type {
  OrderFilter,
  OrderStatus,
  OrderStatusFilter,
  OrderSummary,
  OrdersDataState,
  OrdersRepository,
} from '@/orders/orders.types';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  processing: 'Preparando',
  ready: 'Listo',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const statusTones: Record<OrderStatus, StatusBadgeTone> = {
  pending: 'warning',
  processing: 'info',
  ready: 'success',
  completed: 'success',
  cancelled: 'neutral',
};

const statusOptions: readonly SelectFieldOption<OrderStatusFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'processing', label: 'Preparando' },
  { value: 'ready', label: 'Listos' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const orderColumns: readonly DataTableColumn<OrderSummary>[] = [
  {
    id: 'order',
    header: 'Pedido',
    className: 'min-w-36',
    cell: (order) => (
      <div>
        <p className="font-semibold text-slate-900">{order.number}</p>
        <p className="mt-1 text-[11px] text-slate-400">{order.placedAtLabel}</p>
      </div>
    ),
  },
  {
    id: 'customer',
    header: 'Cliente',
    className: 'min-w-52',
    cell: (order) => <span className="font-medium text-slate-700">{order.customerName}</span>,
  },
  {
    id: 'items',
    header: 'Artículos',
    cell: (order) => `${order.itemCount} ${order.itemCount === 1 ? 'artículo' : 'artículos'}`,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (order) => <StatusBadge label={statusLabels[order.status]} tone={statusTones[order.status]} />,
  },
  {
    id: 'total',
    header: 'Total',
    align: 'right',
    cell: (order) => <span className="font-semibold text-slate-900">{order.totalLabel}</span>,
  },
];

const initialFilter: OrderFilter = {
  search: '',
  status: 'all',
};

export type OrderListViewProps = {
  repository?: OrdersRepository;
};

export function OrderListView({ repository = mockOrdersRepository }: OrderListViewProps) {
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [state, setState] = useState<OrdersDataState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    repository
      .list(filter)
      .then((nextState) => {
        if (active) {
          setState(nextState);
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error', message: 'No fue posible cargar la lista de pedidos.' });
        }
      });

    return () => {
      active = false;
    };
  }, [filter, repository]);

  const hasFilters = filter.search.trim().length > 0 || filter.status !== 'all';

  function setSearch(search: string) {
    setFilter((current) => ({ ...current, search }));
  }

  function setStatus(status: OrderStatusFilter) {
    setFilter((current) => ({ ...current, status }));
  }

  function clearFilters() {
    setFilter(initialFilter);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-brand-600">Operación comercial</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Pedidos recientes</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Busca por número o cliente y filtra rápidamente el flujo operativo de los pedidos.
            </p>
          </div>
          {state.status === 'success' ? (
            <p className="text-xs font-semibold text-slate-500">{state.total} pedidos mostrados</p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <SearchField
            id="orders-search"
            label="Buscar pedidos"
            onChange={setSearch}
            placeholder="Número o cliente"
            value={filter.search}
          />

          <SelectField
            id="orders-status-filter"
            label="Estado del pedido"
            onChange={setStatus}
            options={statusOptions}
            value={filter.status}
          />

          <button
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasFilters}
            onClick={clearFilters}
            type="button"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {state.status === 'loading' || state.status === 'idle' ? (
        <InlineFeedback title="Cargando pedidos" message="Estamos preparando el flujo operativo de esta demo." tone="info" />
      ) : null}

      {state.status === 'error' ? (
        <InlineFeedback title="No se pudo cargar la lista" message={state.message} tone="error" />
      ) : null}

      {state.status === 'empty' ? (
        <InlineFeedback title="Sin coincidencias" message={state.message} />
      ) : null}

      {state.status === 'success' ? (
        <DataTable
          caption="Lista operativa de pedidos"
          columns={orderColumns}
          getRowId={(order) => order.id}
          rows={state.orders}
        />
      ) : null}
    </div>
  );
}
