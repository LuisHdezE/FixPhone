import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('inventory shows actual storefront visibility and a publication filter', () => {
  const view = read('../src/inventory/InventoryView.tsx');
  const repository = read('../src/inventory/apiInventoryRepository.ts');
  const backend = read('../../app/Presentation/Http/Controllers/OperationalInventoryController.php');
  assert.match(view, /header: 'Tienda'/);
  assert.match(view, /inventory-publication-filter/);
  assert.match(view, /item\.storeUrl/);
  assert.match(repository, /record\.store_visible === true/);
  assert.match(repository, /filter\.publication === 'published'/);
  assert.match(repository, /filter\.publication === 'unpublished'/);
  assert.match(backend, /PublishedPartsDonor::query/);
  assert.match(backend, /store_visible/);
  assert.match(backend, /store_url/);
  assert.match(backend, /where\('publication_status', 'publicado'\)/);
});
