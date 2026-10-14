export type OrderStatus = 'pending' | 'processing' | 'ready' | 'cancelled';
export type OrderStatusFilter = 'all' | OrderStatus;

export type OrderItem = {
  inventory_item_id: string;
  item_sku_snapshot: string | null;
  item_name_snapshot: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
};

export type OrderSummary = {
  id: string;
  number: string;
  customer_id: string;
  customer_name: string;
  status: OrderStatus;
  total_amount_minor: number;
  currency_code: string;
  notes: string | null;
  cancel_reason: string | null;
  created_at: string;
  items: readonly OrderItem[];
};

export type OrderCatalog = {
  customers: readonly { id: string; full_name: string; relationship_state: string }[];
  items: readonly {
    id: string;
    sku: string | null;
    title: string;
    item_type: string;
    currency_code: string;
    unit_price_minor: number;
    available_quantity: number;
  }[];
};

export type OrderFormInput = {
  customer_id: string;
  notes: string;
  items: { inventory_item_id: string; quantity: number }[];
};

export type OrderFilter = {
  search: string;
  status: OrderStatusFilter;
};

export type OrdersRepository = {
  list(): Promise<readonly OrderSummary[]>;
  catalog(excludeOrderId?: string): Promise<OrderCatalog>;
  create(input: OrderFormInput): Promise<OrderSummary>;
  update(id: string, input: OrderFormInput): Promise<OrderSummary>;
  changeStatus(id: string, status: Exclude<OrderStatus, 'pending'>, reason?: string): Promise<OrderSummary>;
};

export function formatOrderMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    return currency + ' ' + (amountMinor / 100).toFixed(2);
  }
}
