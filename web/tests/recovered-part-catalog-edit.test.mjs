import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventoryEdit, initialCatalogSelection } from '../src/inventory/inventoryEdit.ts';

const catalog = {
  brands: [{ id: 'samsung', name: 'Samsung', active: true }],
  deviceModels: [
    { id: 'a22', name: 'A22', brandId: 'samsung', active: true },
    { id: 'a32', name: 'A32', brandId: 'samsung', active: true },
  ],
};
const item = { itemType: 'spare_part', brand: 'Samsung', model: 'A22', brandId: 'samsung', modelId: 'a22' };
const descriptionEdit = { title: 'Pantalla probada', description: 'Sin marcas' };

test('descriptive save sends only editable text for an identified recovered part', () => {
  assert.deepEqual(buildInventoryEdit(item, { ...descriptionEdit, ...initialCatalogSelection(item, catalog) }, catalog), descriptionEdit);
});
test('legacy name-based defaults do not silently change technical identity', () => {
  const legacy = { ...item, brandId: null, modelId: null };
  assert.deepEqual(buildInventoryEdit(legacy, { ...descriptionEdit, ...initialCatalogSelection(legacy, catalog) }, catalog), descriptionEdit);
});
test('description can be saved when catalog loading failed or an old model is inactive', () => {
  const unavailable = { brands: [], deviceModels: [] };
  assert.deepEqual(buildInventoryEdit(item, { ...descriptionEdit, ...initialCatalogSelection(item, unavailable) }, unavailable), descriptionEdit);
});
test('an intentional model change includes the catalog identity for backend validation', () => {
  assert.deepEqual(buildInventoryEdit(item, { ...descriptionEdit, brand_id: 'samsung', device_model_id: 'a32' }, catalog), {
    ...descriptionEdit, brand: 'Samsung', model: 'A32', brand_id: 'samsung', device_model_id: 'a32',
  });
});
test('partial or mismatched catalog edits cannot clear identity', () => {
  assert.throws(() => buildInventoryEdit(item, { ...descriptionEdit, brand_id: 'samsung', device_model_id: '' }, catalog));
});
test('non-part descriptions never send catalog changes', () => {
  assert.deepEqual(buildInventoryEdit({ ...item, itemType: 'device' }, { ...descriptionEdit, brand_id: 'other' }, catalog), descriptionEdit);
});
