import { adminFetch } from '@/auth/adminApiSession';
import type {
  CustomerFilter,
  CustomerFormInput,
  CustomerRelationshipState,
  CustomerSummary,
  CustomersCrudRepository,
  CustomersDataState,
} from './customers.types';

type ApiCustomer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  relationship_state: CustomerRelationshipState;
  order_count: number | null;
  last_order_at: string | null;
  lifetime_value_minor: number | null;
};

function mapCustomer(item: ApiCustomer): CustomerSummary {
  return {
    id: item.id,
    name: item.full_name,
    email: item.email ?? '',
    phone: item.phone ?? '',
    notes: item.notes ?? '',
    relationshipState: item.relationship_state,
    orderCount: item.order_count,
    lastOrderLabel: item.last_order_at ?? 'Sin datos de pedidos',
    lifetimeValueLabel: item.lifetime_value_minor === null
      ? 'No disponible'
      : new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(item.lifetime_value_minor / 100),
  };
}

function toPayload(input: CustomerFormInput): Record<string, string | null> {
  return {
    full_name: input.name.trim(),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    notes: input.notes.trim() || null,
    relationship_state: input.relationshipState,
  };
}

async function ensureSuccessful(response: Response): Promise<void> {
  if (response.ok) return;
  const details = await response.json().catch(() => null) as
    | { message?: string; errors?: Record<string, string[]> } | null;
  const validationErrors = details?.errors
    ? Object.values(details.errors).flat().join(' ')
    : '';
  throw new Error(validationErrors || details?.message || 'No se pudo completar la operación. Código ' + response.status);
}

async function fetchCustomer(path: string, method: string, input: CustomerFormInput): Promise<CustomerSummary> {
  const response = await adminFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(input)),
  });
  await ensureSuccessful(response);
  const payload = await response.json() as { data: ApiCustomer };
  return mapCustomer(payload.data);
}

export const apiCustomersRepository: CustomersCrudRepository = {
  async list(filter: CustomerFilter): Promise<CustomersDataState> {
    const response = await adminFetch('/api/v1/admin/customers', { cache: 'no-store' });
    await ensureSuccessful(response);
    const payload = await response.json() as { data: ApiCustomer[] };
    const customers = payload.data.map(mapCustomer);
    const search = filter.search.trim().toLocaleLowerCase('es');
    const filtered = customers.filter(customer => {
      const matchesSearch = !search || [customer.name, customer.email, customer.phone].some(
        value => value.toLocaleLowerCase('es').includes(search)
      );
      const matchesRelationship = filter.relationshipState === 'all'
        || customer.relationshipState === filter.relationshipState;
      return matchesSearch && matchesRelationship;
    });
    return filtered.length > 0
      ? { status: 'success', customers: filtered, total: filtered.length }
      : { status: 'empty', message: 'No hay clientes registrados que coincidan con los filtros.' };
  },

  async create(input: CustomerFormInput): Promise<CustomerSummary> {
    return fetchCustomer('/api/v1/admin/customers', 'POST', input);
  },

  async update(id: string, input: CustomerFormInput): Promise<CustomerSummary> {
    return fetchCustomer('/api/v1/admin/customers/' + encodeURIComponent(id), 'PATCH', input);
  },

  async archive(id: string): Promise<void> {
    const response = await adminFetch('/api/v1/admin/customers/' + encodeURIComponent(id), { method: 'DELETE' });
    await ensureSuccessful(response);
  },
};
