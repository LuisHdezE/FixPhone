export type FaultType = 'icloud' | 'no_signal' | 'board' | 'other';
export type ScreenCondition = 'good' | 'damaged' | 'unknown';
export type PowerState = 'yes' | 'no' | 'unknown';
export type PublicationStatus = 'draft' | 'published' | 'closed';

export interface DeviceValuation {
  id: string;
  inventory_item_id: string | null;
  model_name: string;
  fault_type: FaultType;
  screen_condition: ScreenCondition;
  power_state: PowerState;
  estimated_min_minor: number | null;
  estimated_max_minor: number | null;
  asking_price_minor: number | null;
  minimum_price_minor: number | null;
  publication_status: PublicationStatus;
  market_reference: string | null;
  notes: string | null;
  facebook_copy: string | null;
  facebook_post_url: string | null;
  created_at: string;
  updated_at: string;
}
export type ValuationPayload = Omit<DeviceValuation, 'id' | 'created_at' | 'updated_at'>;
