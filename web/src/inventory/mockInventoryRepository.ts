import type { InventoryDataState, InventoryFilter, InventoryItem, InventoryRepository } from './inventory.types';
const items: readonly InventoryItem[] = [
  { id: 'inv-001', productName: 'Pantalla OLED iPhone 13', sku: 'FP-DIS-IP13-OLED', category: 'Pantallas', stockQuantity: 8, reorderPoint: 4, health: 'healthy', updatedAtLabel: 'Hace 12 min' },
  { id: 'inv-002', productName: 'Batería iPhone 11', sku: 'FP-BAT-IP11', category: 'Baterías', stockQuantity: 3, reorderPoint: 5, health: 'reorder', updatedAtLabel: 'Hace 28 min' },
  { id: 'inv-003', productName: 'Puerto de carga Galaxy A52', sku: 'FP-CHG-A52', category: 'Puertos de carga', stockQuantity: 0, reorderPoint: 3, health: 'out-of-stock', updatedAtLabel: 'Hace 1 h' },
  { id: 'inv-004', productName: 'Cámara trasera iPhone 12 usada', sku: 'FP-CAM-IP12-U', category: 'Cámaras usadas', stockQuantity: 6, reorderPoint: 2, health: 'healthy', updatedAtLabel: 'Hace 2 h' },
  { id: 'inv-005', productName: 'Flex de encendido Redmi Note 11', sku: 'FP-FLX-RN11-PWR', category: 'Flex', stockQuantity: 2, reorderPoint: 4, health: 'reorder', updatedAtLabel: 'Ayer' },
  { id: 'inv-006', productName: 'Altavoz inferior iPhone XR usado', sku: 'FP-SPK-IPXR-U', category: 'Audio usado', stockQuantity: 0, reorderPoint: 2, health: 'out-of-stock', updatedAtLabel: 'Ayer' },
];
const normalize = (value: string) => value.trim().toLocaleLowerCase('es');
export const mockInventoryRepository: InventoryRepository = { async list(filter: InventoryFilter): Promise<InventoryDataState> { const q = normalize(filter.search); const filtered = items.filter((item) => (filter.health === 'all' || item.health === filter.health) && (!q || [item.productName, item.sku, item.category].some((value) => normalize(value).includes(q)))); return filtered.length ? { status: 'success', items: filtered, total: filtered.length } : { status: 'empty', message: 'No encontramos existencias que coincidan con los filtros actuales.' }; } };
