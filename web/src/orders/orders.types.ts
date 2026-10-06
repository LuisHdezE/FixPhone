export type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';

export type OrderStatusFilter = 'all' | OrderStatus;

export type OrderFilter = {
  search: string;
  status: OrderStatusFilter;
};

export type OrderSummary = {
  id: string;
  number: string;
  customerName: string;
  placedAtLabel: string;
  itemCount: number;
  totalLabel: string;
  status: OrderStatus;
};

export type OrdersDataState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; orders: readonly OrderSummary[]; total: number }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

export type OrdersRepository = {
  list: (filter: OrderFilter) => Promise<OrdersDataState>;
};
