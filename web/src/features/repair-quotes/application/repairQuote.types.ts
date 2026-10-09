export type DeviceTier = 'baja' | 'media' | 'alta';

export interface RepairQuoteService {
  name: string;
  price_minor: number;
}
export interface RepairQuotePart {
  name: string;
  unit_cost_minor: number;
  quantity: number;
}
export interface RepairQuotePayload {
  customer_name: string | null;
  customer_contact: string | null;
  device_description: string | null;
  device_tier: DeviceTier;
  services: RepairQuoteService[];
  parts: RepairQuotePart[];
  courier_minor: number;
  discount_minor: number;
  notes: string | null;
}
export interface RepairQuote extends RepairQuotePayload {
  id: string;
  parts_markup_percent: number;
  services_subtotal_minor: number;
  parts_base_minor: number;
  parts_total_minor: number;
  total_minor: number;
  currency_code: 'UYU';
  created_by: string;
  created_at: string;
  updated_at: string;
}
