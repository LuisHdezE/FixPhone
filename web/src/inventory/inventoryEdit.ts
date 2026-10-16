import type { InventoryEdit, InventoryItem } from './inventory.types';

export type CatalogItem = { id: string; name: string; active: boolean; brandId?: string };
type Catalog = { brands: CatalogItem[]; deviceModels: CatalogItem[] };
type ItemIdentity = Pick<InventoryItem, 'itemType' | 'brand' | 'model' | 'brandId' | 'modelId'>;

export function initialCatalogSelection(item: ItemIdentity, catalog: Catalog) {
  const brandId = item.brandId ?? catalog.brands.find((entry) => entry.name === item.brand)?.id ?? '';
  const modelId = item.modelId ?? catalog.deviceModels.find((entry) => entry.name === item.model && entry.brandId === brandId)?.id ?? '';
  return { brand_id: brandId, device_model_id: modelId };
}

export function buildInventoryEdit(item: ItemIdentity, edit: InventoryEdit, catalog: Catalog): InventoryEdit {
  const payload: InventoryEdit = { title: edit.title, description: edit.description };
  if (item.itemType !== 'spare_part') return payload;
  const initial = initialCatalogSelection(item, catalog);
  if ((edit.brand_id ?? '') === initial.brand_id && (edit.device_model_id ?? '') === initial.device_model_id) return payload;
  const brand = catalog.brands.find((entry) => entry.active && entry.id === edit.brand_id);
  const model = catalog.deviceModels.find((entry) => entry.active && entry.id === edit.device_model_id && entry.brandId === brand?.id);
  if (!brand || !model) throw new Error('Seleccioná marca y modelo válidos del catálogo.');
  return { ...payload, brand: brand.name, model: model.name, brand_id: brand.id, device_model_id: model.id };
}
