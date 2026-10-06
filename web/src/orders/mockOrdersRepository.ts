import type { OrderFilter, OrderSummary, OrdersRepository } from '@/orders/orders.types';

const orders: readonly OrderSummary[] = [
  {
    id: 'order-1058',
    number: '#PS-1058',
    customerName: 'Camila Silva',
    placedAtLabel: 'Hoy · 10:42',
    itemCount: 3,
    totalLabel: '$ 2.890',
    status: 'pending',
  },
  {
    id: 'order-1057',
    number: '#PS-1057',
    customerName: 'Martín Rodríguez',
    placedAtLabel: 'Hoy · 09:18',
    itemCount: 1,
    totalLabel: '$ 1.250',
    status: 'ready',
  },
  {
    id: 'order-1056',
    number: '#PS-1056',
    customerName: 'Lucía Fernández',
    placedAtLabel: 'Ayer · 18:35',
    itemCount: 4,
    totalLabel: '$ 4.760',
    status: 'processing',
  },
  {
    id: 'order-1055',
    number: '#PS-1055',
    customerName: 'Diego Pereira',
    placedAtLabel: 'Ayer · 16:10',
    itemCount: 2,
    totalLabel: '$ 1.980',
    status: 'completed',
  },
  {
    id: 'order-1054',
    number: '#PS-1054',
    customerName: 'Sofía Ramos',
    placedAtLabel: 'Ayer · 12:22',
    itemCount: 1,
    totalLabel: '$ 890',
    status: 'cancelled',
  },
  {
    id: 'order-1053',
    number: '#PS-1053',
    customerName: 'Valentina Acosta',
    placedAtLabel: '20 sep · 17:04',
    itemCount: 5,
    totalLabel: '$ 6.420',
    status: 'completed',
  },
  {
    id: 'order-1052',
    number: '#PS-1052',
    customerName: 'Nicolás Gómez',
    placedAtLabel: '20 sep · 13:47',
    itemCount: 2,
    totalLabel: '$ 2.340',
    status: 'ready',
  },
  {
    id: 'order-1051',
    number: '#PS-1051',
    customerName: 'Mariana López',
    placedAtLabel: '19 sep · 19:30',
    itemCount: 3,
    totalLabel: '$ 3.110',
    status: 'processing',
  },
  {
    id: 'order-1050',
    number: '#PS-1050',
    customerName: 'Federico Sosa',
    placedAtLabel: '19 sep · 11:08',
    itemCount: 1,
    totalLabel: '$ 760',
    status: 'completed',
  },
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

function matchesSearch(order: OrderSummary, search: string) {
  if (!search) {
    return true;
  }

  return [order.number, order.customerName]
    .map(normalize)
    .some((value) => value.includes(search));
}

export const mockOrdersRepository: OrdersRepository = {
  async list(filter: OrderFilter) {
    const normalizedSearch = normalize(filter.search);
    const filteredOrders = orders.filter((order) => {
      const matchesStatus = filter.status === 'all' || order.status === filter.status;
      return matchesStatus && matchesSearch(order, normalizedSearch);
    });

    if (filteredOrders.length === 0) {
      return {
        status: 'empty',
        message: 'No encontramos pedidos que coincidan con los filtros actuales.',
      };
    }

    return {
      status: 'success',
      orders: filteredOrders,
      total: filteredOrders.length,
    };
  },
};
