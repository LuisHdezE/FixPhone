import type {
  CustomerFilter,
  CustomerSummary,
  CustomersRepository,
} from '@/customers/customers.types';

const customers: readonly CustomerSummary[] = [
  {
    id: 'cust-001',
    name: 'Mariana Suárez',
    email: 'mariana.suarez@example.com',
    phone: '+598 99 412 807',
    petCount: 2,
    orderCount: 18,
    lastOrderLabel: 'Hace 3 días',
    lifetimeValueLabel: '$ 18.420',
    relationshipState: 'active',
  },
  {
    id: 'cust-002',
    name: 'Diego Pereira',
    email: 'diego.pereira@example.com',
    phone: '+598 98 774 221',
    petCount: 1,
    orderCount: 9,
    lastOrderLabel: 'Hace 8 días',
    lifetimeValueLabel: '$ 9.870',
    relationshipState: 'active',
  },
  {
    id: 'cust-003',
    name: 'Lucía Fernández',
    email: 'lucia.fernandez@example.com',
    phone: '+598 94 618 530',
    petCount: 3,
    orderCount: 14,
    lastOrderLabel: 'Hace 15 días',
    lifetimeValueLabel: '$ 14.260',
    relationshipState: 'attention',
  },
  {
    id: 'cust-004',
    name: 'Pablo Rodríguez',
    email: 'pablo.rodriguez@example.com',
    phone: '+598 91 305 662',
    petCount: 1,
    orderCount: 5,
    lastOrderLabel: 'Hace 21 días',
    lifetimeValueLabel: '$ 5.540',
    relationshipState: 'attention',
  },
  {
    id: 'cust-005',
    name: 'Valentina Méndez',
    email: 'valentina.mendez@example.com',
    phone: '+598 96 821 114',
    petCount: 2,
    orderCount: 22,
    lastOrderLabel: 'Ayer',
    lifetimeValueLabel: '$ 24.810',
    relationshipState: 'active',
  },
  {
    id: 'cust-006',
    name: 'Andrés Cabrera',
    email: 'andres.cabrera@example.com',
    phone: '+598 97 446 390',
    petCount: 1,
    orderCount: 2,
    lastOrderLabel: 'Hace 47 días',
    lifetimeValueLabel: '$ 2.180',
    relationshipState: 'inactive',
  },
  {
    id: 'cust-007',
    name: 'Camila Silva',
    email: 'camila.silva@example.com',
    phone: '+598 92 734 905',
    petCount: 4,
    orderCount: 27,
    lastOrderLabel: 'Hoy',
    lifetimeValueLabel: '$ 31.460',
    relationshipState: 'active',
  },
  {
    id: 'cust-008',
    name: 'Martín Acosta',
    email: 'martin.acosta@example.com',
    phone: '+598 95 163 778',
    petCount: 1,
    orderCount: 3,
    lastOrderLabel: 'Hace 62 días',
    lifetimeValueLabel: '$ 3.120',
    relationshipState: 'inactive',
  },
];

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('es');
}

export const mockCustomersRepository: CustomersRepository = {
  async list(filter: CustomerFilter) {
    const search = normalize(filter.search);

    const filtered = customers.filter((customer) => {
      const matchesSearch =
        search.length === 0 ||
        [customer.name, customer.email, customer.phone]
          .map(normalize)
          .some((value) => value.includes(search));
      const matchesRelationship =
        filter.relationshipState === 'all' ||
        customer.relationshipState === filter.relationshipState;

      return matchesSearch && matchesRelationship;
    });

    if (filtered.length === 0) {
      return {
        status: 'empty',
        message: 'No encontramos clientes que coincidan con los filtros actuales.',
      } as const;
    }

    return {
      status: 'success',
      customers: filtered,
      total: filtered.length,
    } as const;
  },
};
