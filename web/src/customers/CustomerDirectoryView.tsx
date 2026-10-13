import { useEffect, useState } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { AppIcon } from '@/components/AppIcon';
import { Avatar } from '@/components/data-display/Avatar';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField, type SelectFieldOption } from '@/components/forms/SelectField';
import { ModalShell } from '@/components/layout/ModalShell';
import { CustomerFormModal } from './CustomerFormModal';
import { apiCustomersRepository } from './apiCustomersRepository';
import type {
  CustomerFilter,
  CustomerRelationshipFilter,
  CustomerRelationshipState,
  CustomerSummary,
  CustomersCrudRepository,
  CustomersDataState,
} from './customers.types';

const relationshipLabels: Record<CustomerRelationshipState, string> = {
  active: 'Activo', attention: 'Seguimiento', inactive: 'Inactivo',
};

const relationshipTones: Record<CustomerRelationshipState, StatusBadgeTone> = {
  active: 'success', attention: 'warning', inactive: 'neutral',
};

const relationshipOptions: readonly SelectFieldOption<CustomerRelationshipFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'attention', label: 'Seguimiento' },
  { value: 'inactive', label: 'Inactivos' },
];

const initialFilter: CustomerFilter = { search: '', relationshipState: 'all' };

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; customer: CustomerSummary }
  | { kind: 'view'; customer: CustomerSummary }
  | null;

type CustomerDirectoryViewProps = {
  repository?: CustomersCrudRepository;
};

function CustomerDetails({ customer, onClose }: { customer: CustomerSummary; onClose: () => void }) {
  const fields = [
    ['Nombre', customer.name],
    ['Teléfono', customer.phone || 'Sin registrar'],
    ['Correo', customer.email || 'Sin registrar'],
    ['Estado', relationshipLabels[customer.relationshipState]],
    ['Pedidos', 'No conectado al historial de pedidos'],
    ['Valor acumulado', 'No disponible'],
  ] as const;

  return <ModalShell title={'Ficha del cliente · ' + customer.name} onClose={onClose}>
    <div className="grid gap-3 p-4">
      <dl className="grid gap-2 sm:grid-cols-2">
        {fields.map(([label, value]) => <div className="rounded-md bg-slate-50 p-3" key={label}>
          <dt className="text-xs font-semibold text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd>
        </div>)}
      </dl>
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500">Observaciones</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{customer.notes || 'Sin observaciones.'}</p>
      </div>
    </div>
  </ModalShell>;
}

export function CustomerDirectoryView({ repository = apiCustomersRepository }: CustomerDirectoryViewProps) {
  const [filter, setFilter] = useState<CustomerFilter>(initialFilter);
  const [state, setState] = useState<CustomersDataState>({ status: 'loading' });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });

    Promise.all([
      repository.list(filter),
      adminFetch('/api/v1/auth/me', { cache: 'no-store' }),
    ]).then(async ([nextState, identity]) => {
      if (!identity.ok) throw new Error('No se pudieron verificar los permisos de tu cuenta.');
      const body = await identity.json() as { data?: { permissions?: string[] } };
      const permissions = Array.isArray(body.data?.permissions) ? body.data.permissions : [];
      if (active) {
        setCanManage(permissions.includes('catalog.manage'));
        setState(nextState);
      }
    }).catch(error => {
      if (active) {
        setCanManage(false);
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'No fue posible cargar el directorio de clientes.',
        });
      }
    });

    return () => { active = false; };
  }, [filter, repository, refreshVersion]);

  const hasFilters = filter.search.trim() !== '' || filter.relationshipState !== 'all';
  const customers = state.status === 'success' ? state.customers : [];

  function reload() {
    setRefreshVersion(version => version + 1);
  }

  function afterSave(message: string) {
    setDialog(null);
    setActionError(null);
    setNotice(message);
    reload();
  }

  async function archive(customer: CustomerSummary) {
    if (!canManage || busyId !== null) return;
    if (!window.confirm('¿Archivar a ' + customer.name + '? Esta acción retira al cliente del directorio. No se borrará la auditoría ni se desvincularán pedidos.')) return;

    setBusyId(customer.id);
    setActionError(null);
    setNotice(null);
    try {
      await repository.archive(customer.id);
      setNotice('Cliente archivado correctamente.');
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No se pudo archivar al cliente.');
    } finally {
      setBusyId(null);
    }
  }

  const actionIconClass = 'grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40';

  const columns: readonly DataTableColumn<CustomerSummary>[] = [
    {
      id: 'customer', header: 'Cliente', className: 'min-w-56',
      cell: customer => <div className="flex items-center gap-2">
        <Avatar name={customer.name}/>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{customer.name}</p>
          <p className="text-[11px] text-slate-400">{customer.email || 'Sin correo registrado'}</p>
        </div>
      </div>,
    },
    {
      id: 'contact', header: 'Contacto',
      cell: customer => <span className="font-medium text-slate-700">{customer.phone || 'Sin teléfono registrado'}</span>,
    },
    {
      id: 'activity', header: 'Actividad',
      cell: () => <span className="text-xs text-slate-500" title="Pendiente de integrar con pedidos reales">Sin historial conectado</span>,
    },
    {
      id: 'relationship', header: 'Relación',
      cell: customer => <StatusBadge label={relationshipLabels[customer.relationshipState]} tone={relationshipTones[customer.relationshipState]}/>,
    },
    {
      id: 'value', header: 'Valor acumulado', align: 'right',
      cell: customer => <span className="text-xs text-slate-500">{customer.lifetimeValueLabel}</span>,
    },
    {
      id: 'actions', header: 'Acciones', align: 'right',
      cell: customer => <div className="flex items-center justify-end gap-1">
        <button className={actionIconClass} aria-label={'Ver ' + customer.name} title={'Ver ' + customer.name} onClick={() => setDialog({ kind: 'view', customer })} type="button">
          <AppIcon className="size-3.5" name="search"/>
        </button>
        {canManage ? <button className={actionIconClass} aria-label={'Editar ' + customer.name} title={'Editar ' + customer.name} disabled={busyId !== null} onClick={() => setDialog({ kind: 'edit', customer })} type="button">
          <AppIcon className="size-3.5" name="edit"/>
        </button> : null}
        {canManage ? <button className={actionIconClass + ' text-red-600 hover:bg-red-50'} aria-label={'Archivar ' + customer.name} title={'Archivar ' + customer.name} disabled={busyId !== null} onClick={() => void archive(customer)} type="button">
          <AppIcon className="size-3.5" name="trash"/>
        </button> : null}
      </div>,
    },
  ];

  return <div className="grid gap-3">
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-brand-600">Relación comercial</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Directorio de clientes</h3>
          <p className="mt-1 text-xs text-slate-500">Administración de clientes registrados en FixPhone.</p>
        </div>
        <div className="flex items-center gap-3">
          {state.status === 'success' ? <span className="text-xs text-slate-500">{state.total} clientes mostrados</span> : null}
          {canManage ? <button className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700" onClick={() => setDialog({ kind: 'create' })} type="button">Registrar</button> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <SearchField id="customers-search" label="Buscar clientes" onChange={search => setFilter(current => ({ ...current, search }))} placeholder="Nombre, correo o teléfono" value={filter.search}/>
        <SelectField id="customers-relationship-filter" label="Estado de relación" onChange={relationshipState => setFilter(current => ({ ...current, relationshipState }))} options={relationshipOptions} value={filter.relationshipState}/>
        <button className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={!hasFilters} onClick={() => setFilter(initialFilter)} type="button">Limpiar filtros</button>
      </div>
    </section>

    {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800" role="status">{notice}</p> : null}
    {actionError ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{actionError}</p> : null}

    {state.status === 'loading' || state.status === 'idle'
      ? <InlineFeedback title="Cargando clientes" message="Consultando el directorio real de FixPhone." tone="info"/> : null}
    {state.status === 'error'
      ? <div className="grid gap-2"><InlineFeedback title="No se pudo cargar el directorio" message={state.message} tone="error"/>
        <button className="w-fit rounded-md border px-3 py-2 text-xs" type="button" onClick={reload}>Reintentar</button>
      </div> : null}
    {state.status === 'empty' ? <InlineFeedback title="Sin clientes" message={state.message}/> : null}
    {state.status === 'success' ? <DataTable caption="Directorio de clientes" columns={columns} density="compact" paginationStyle="compact" initialPageSize={10} pageSizeOptions={[10, 20, 50]} getRowId={customer => customer.id} rows={customers}/> : null}

    {dialog?.kind === 'view' ? <CustomerDetails customer={dialog.customer} onClose={() => setDialog(null)}/> : null}
    {dialog?.kind === 'create' ? <CustomerFormModal repository={repository} onClose={() => setDialog(null)} onSaved={afterSave}/> : null}
    {dialog?.kind === 'edit' ? <CustomerFormModal key={dialog.customer.id} customer={dialog.customer} repository={repository} onClose={() => setDialog(null)} onSaved={afterSave}/> : null}
  </div>;
}
