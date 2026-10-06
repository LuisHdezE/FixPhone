import { useEffect, useState } from 'react';
import { Avatar } from '@/components/data-display/Avatar';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField, type SelectFieldOption } from '@/components/forms/SelectField';
import { mockCustomersRepository } from '@/customers/mockCustomersRepository';
import type {
  CustomerFilter,
  CustomerRelationshipFilter,
  CustomerRelationshipState,
  CustomerSummary,
  CustomersDataState,
  CustomersRepository,
} from '@/customers/customers.types';

const relationshipLabels: Record<CustomerRelationshipState, string> = {
  active: 'Activo',
  attention: 'Seguimiento',
  inactive: 'Inactivo',
};

const relationshipTones: Record<CustomerRelationshipState, StatusBadgeTone> = {
  active: 'success',
  attention: 'warning',
  inactive: 'neutral',
};

const relationshipOptions: readonly SelectFieldOption<CustomerRelationshipFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'attention', label: 'Seguimiento' },
  { value: 'inactive', label: 'Inactivos' },
];

const customerColumns: readonly DataTableColumn<CustomerSummary>[] = [
  {
    id: 'customer',
    header: 'Cliente',
    className: 'min-w-72',
    cell: (customer) => (
      <div className="flex items-center gap-3">
        <Avatar name={customer.name} />
        <div>
          <p className="font-semibold text-slate-900">{customer.name}</p>
          <p className="mt-1 text-[11px] text-slate-400">{customer.email}</p>
        </div>
      </div>
    ),
  },
  {
    id: 'contact',
    header: 'Contacto',
    cell: (customer) => (
      <div>
        <p className="font-medium text-slate-700">{customer.phone}</p>
        <p className="mt-1 text-[11px] text-slate-400">{customer.petCount} {customer.petCount === 1 ? 'mascota' : 'mascotas'}</p>
      </div>
    ),
  },
  {
    id: 'activity',
    header: 'Actividad',
    cell: (customer) => (
      <div>
        <p className="font-medium text-slate-700">{customer.orderCount} pedidos</p>
        <p className="mt-1 text-[11px] text-slate-400">Último pedido: {customer.lastOrderLabel}</p>
      </div>
    ),
  },
  {
    id: 'relationship',
    header: 'Relación',
    cell: (customer) => (
      <StatusBadge
        label={relationshipLabels[customer.relationshipState]}
        tone={relationshipTones[customer.relationshipState]}
      />
    ),
  },
  {
    id: 'value',
    header: 'Valor acumulado',
    align: 'right',
    cell: (customer) => <span className="font-semibold text-slate-900">{customer.lifetimeValueLabel}</span>,
  },
];

const initialFilter: CustomerFilter = {
  search: '',
  relationshipState: 'all',
};

export type CustomerDirectoryViewProps = {
  repository?: CustomersRepository;
};

export function CustomerDirectoryView({ repository = mockCustomersRepository }: CustomerDirectoryViewProps) {
  const [filter, setFilter] = useState<CustomerFilter>(initialFilter);
  const [state, setState] = useState<CustomersDataState>({ status: 'loading' });

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
          setState({ status: 'error', message: 'No fue posible cargar el directorio de clientes.' });
        }
      });

    return () => {
      active = false;
    };
  }, [filter, repository]);

  const hasFilters = filter.search.trim().length > 0 || filter.relationshipState !== 'all';

  function setSearch(search: string) {
    setFilter((current) => ({ ...current, search }));
  }

  function setRelationshipState(relationshipState: CustomerRelationshipFilter) {
    setFilter((current) => ({ ...current, relationshipState }));
  }

  function clearFilters() {
    setFilter(initialFilter);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-brand-600">Relación comercial</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Directorio de clientes</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Localiza clientes por nombre, correo o teléfono y revisa rápidamente su actividad reciente.
            </p>
          </div>
          {state.status === 'success' ? (
            <p className="text-xs font-semibold text-slate-500">{state.total} clientes mostrados</p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <SearchField
            id="customers-search"
            label="Buscar clientes"
            onChange={setSearch}
            placeholder="Nombre, correo o teléfono"
            value={filter.search}
          />

          <SelectField
            id="customers-relationship-filter"
            label="Estado de relación"
            onChange={setRelationshipState}
            options={relationshipOptions}
            value={filter.relationshipState}
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
        <InlineFeedback title="Cargando clientes" message="Estamos preparando el directorio comercial de esta demo." tone="info" />
      ) : null}

      {state.status === 'error' ? (
        <InlineFeedback title="No se pudo cargar el directorio" message={state.message} tone="error" />
      ) : null}

      {state.status === 'empty' ? (
        <InlineFeedback title="Sin coincidencias" message={state.message} />
      ) : null}

      {state.status === 'success' ? (
        <DataTable
          caption="Directorio de clientes"
          columns={customerColumns}
          getRowId={(customer) => customer.id}
          rows={state.customers}
        />
      ) : null}
    </div>
  );
}
