export type InventoryHealth = 'healthy' | 'reorder' | 'out-of-stock';
export type InventoryHealthFilter = 'all' | InventoryHealth;
export type InventoryFilter = { search: string; health: InventoryHealthFilter };
export type InventoryItem = { id: string; productName: string; sku: string; category: string; stockQuantity: number; reorderPoint: number; health: InventoryHealth; updatedAtLabel: string };
export type InventoryDataState = { status: 'idle' } | { status: 'loading' } | { status: 'success'; items: readonly InventoryItem[]; total: number } | { status: 'empty'; message: string } | { status: 'error'; message: string };
export type InventoryRepository = { list: (filter: InventoryFilter) => Promise<InventoryDataState> };
