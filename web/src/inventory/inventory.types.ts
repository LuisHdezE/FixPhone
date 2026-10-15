export type InventoryHealth = 'healthy' | 'reorder' | 'out-of-stock' | 'available';
export type InventoryHealthFilter = 'all' | InventoryHealth;
export type InventoryFilter = { search: string; health: InventoryHealthFilter };

export type InventoryItem = {
  id: string;
  productName: string;
  sku: string;
  category: string;
  itemType: string;
  brand: string | null;
  model: string | null;
  brandId: string | null;
  modelId: string | null;
  description: string | null;
  inventoryPurpose: string;
  operationalStatus: string;
  publicationStatus: string;
  stockQuantity: number;
  reorderPoint: number | null;
  health: InventoryHealth;
  updatedAtLabel: string;
};

export type InventoryEdit = {
  brand_id?: string;
  device_model_id?: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
};

export type StockAdjustment = {
  id: string;
  quantity_before: number;
  quantity_delta: number;
  quantity_after: number;
  reason: string;
  created_at: string;
};

export type InventoryDataState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; items: readonly InventoryItem[]; total: number }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

export type InventoryRepository = {
  list: (filter: InventoryFilter) => Promise<InventoryDataState>;
  update: (id: string, edit: InventoryEdit) => Promise<void>;
  createSpare: (data: { name: string; brand_id: string; device_model_id: string; description: string; initial_stock: number }) => Promise<void>;
  adjust: (id: string, delta: number, reason: string, requestId: string) => Promise<void>;
  adjustments: (id: string) => Promise<readonly StockAdjustment[]>;
};
