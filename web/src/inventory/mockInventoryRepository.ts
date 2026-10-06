import type { InventoryDataState, InventoryFilter, InventoryItem, InventoryRepository } from './inventory.types';
const items: readonly InventoryItem[] = [
  { id: 'inv-001', productName: 'Alimento premium canino 12 kg', sku: 'PET-ALI-001', category: 'Alimentos', stockQuantity: 24, reorderPoint: 10, health: 'healthy', updatedAtLabel: 'Hace 12 min' },
  { id: 'inv-002', productName: 'Arena sanitaria aglomerante 8 kg', sku: 'PET-HIG-014', category: 'Higiene', stockQuantity: 7, reorderPoint: 10, health: 'reorder', updatedAtLabel: 'Hace 28 min' },
  { id: 'inv-003', productName: 'Juguete mordedor de caucho', sku: 'PET-JUG-032', category: 'Juguetes', stockQuantity: 0, reorderPoint: 8, health: 'out-of-stock', updatedAtLabel: 'Hace 1 h' },
  { id: 'inv-004', productName: 'Collar reflectivo ajustable', sku: 'PET-ACC-021', category: 'Accesorios', stockQuantity: 18, reorderPoint: 6, health: 'healthy', updatedAtLabel: 'Hace 2 h' },
  { id: 'inv-005', productName: 'Cama acolchada mediana', sku: 'PET-DES-008', category: 'Descanso', stockQuantity: 5, reorderPoint: 8, health: 'reorder', updatedAtLabel: 'Ayer' },
  { id: 'inv-006', productName: 'Transportadora rígida pequeña', sku: 'PET-TRA-011', category: 'Transporte', stockQuantity: 0, reorderPoint: 4, health: 'out-of-stock', updatedAtLabel: 'Ayer' },
];
const normalize = (value: string) => value.trim().toLocaleLowerCase('es');
export const mockInventoryRepository: InventoryRepository = { async list(filter: InventoryFilter): Promise<InventoryDataState> { const q = normalize(filter.search); const filtered = items.filter((item) => (filter.health === 'all' || item.health === filter.health) && (!q || [item.productName, item.sku, item.category].some((value) => normalize(value).includes(q)))); return filtered.length ? { status: 'success', items: filtered, total: filtered.length } : { status: 'empty', message: 'No encontramos existencias que coincidan con los filtros actuales.' }; } };
