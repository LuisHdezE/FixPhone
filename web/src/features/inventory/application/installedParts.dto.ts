export interface DeviceInstalledPartDto {
  id: string;
  inventory_item_id: string;
  spare_part_item_id: string | null;
  part_name: string;
  cost_amount_minor: number;
  currency_code: string;
  installed_at: string | null;
  installed_by_actor_id: string;
  notes: string | null;
  voided_at: string | null;
  voided_by_actor_id: string | null;
  void_reason: string | null;
  created_at: string | null;
}

export interface DeviceInstalledPartsListDto {
  device: {
    id: string;
    sku: string | null;
    title: string;
    brand: string | null;
    model: string | null;
    cost_amount_minor: number | null;
    sale_price_amount_minor: number | null;
    currency_code: string;
    operational_status: string;
    inventory_purpose: string;
  };
  installed_parts: DeviceInstalledPartDto[];
  total_installed_parts_cost_minor: number;
  currency_code: string;
}

export interface InstalledPartsExpenseDeviceSummaryDto {
  device_id: string;
  sku: string | null;
  title: string;
  brand: string | null;
  model: string | null;
  parts_count: number;
  total_parts_cost_minor: number;
  currency_code: string;
  parts: {
    id: string;
    part_name: string;
    cost_amount_minor: number;
    installed_at: string | null;
    notes: string | null;
  }[];
}

export interface InstalledPartsExpenseReportDto {
  period: string;
  total_expenses_minor: number;
  total_parts_count: number;
  total_devices_count: number;
  currency_code: string;
  by_device: InstalledPartsExpenseDeviceSummaryDto[];
}

export interface DirectSaleSettlementItemDto {
  device_id: string;
  sku: string | null;
  title: string;
  brand: string | null;
  model: string | null;
  inventory_purpose: string;
  operational_status: string;
  sale_price_amount_minor: number;
  initial_cost_amount_minor: number | null;
  installed_parts_cost_minor: number;
  installed_parts_count: number;
  settlable_profit_minor: number | null;
  liquidation_percentage: number;
  liquidation_amount_minor: number;
  currency_code: string;
  status: 'eligible' | 'pending_review' | 'negative_profit' | 'incompatible_currency';
  status_label: string;
  status_reason: string | null;
  sold_at: string | null;
}

export interface DirectSalesSettlementReportDto {
  period: string;
  formula: string;
  totals: {
    total_direct_sales_count: number;
    total_sales_amount_minor: number;
    total_initial_costs_minor: number;
    total_installed_parts_costs_minor: number;
    total_settlable_profit_minor: number;
    total_liquidation_amount_minor: number;
    currency_code: string;
  };
  settlements: DirectSaleSettlementItemDto[];
}
