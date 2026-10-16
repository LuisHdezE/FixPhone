import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const primary = read('../src/features/master-data/presentation/MasterDataAdminPages.tsx');
const extended = read('../src/features/master-data/presentation/ExtendedMasterDataAdminPages.tsx');
const notices = read('../src/features/master-data/presentation/AdminNotice.tsx');

test('master data pages do not render the redundant permanent API banner', () => {
  for (const source of [primary, extended]) {
    assert.doesNotMatch(source, /PersistenceNote/);
    assert.doesNotMatch(source, /Conectado a la API\. Los cambios se guardan/);
  }
});

test('master data pages use the same dismissible feedback component', () => {
  for (const source of [primary, extended]) {
    assert.match(source, /import \{ AdminNotice, type Notice \} from '\.\/AdminNotice'/);
    assert.match(source, /onDismiss=\{dismissNotice\}/);
  }
});

test('success notices expire while warnings remain persistent', () => {
  assert.match(notices, /notice\?\.tone !== 'success'/);
  assert.match(notices, /setTimeout\(onDismiss, 4000\)/);
  assert.match(notices, /clearTimeout\(timeout\)/);
  assert.match(notices, /notice\.tone === 'warning'/);
  assert.match(notices, /role="alert"/);
});

test('other admin screens use temporary success feedback', () => {
  const screens = [
    '../src/features/inventory/presentation/InventoryDevicesPage.tsx',
    '../src/features/media-storage/presentation/MediaStorageSettingsPage.tsx',
    '../src/features/reference-prices/presentation/ReferencePriceImportPage.tsx',
    '../src/features/repair-quotes/presentation/RepairQuotesPage.tsx',
    '../src/features/valuation/presentation/ValuPhonePage.tsx',
    '../src/features/prompts/presentation/AiPromptCatalogPage.tsx',
    '../src/customers/CustomerDirectoryView.tsx',
    '../src/orders/OrderListView.tsx',
  ];
  for (const screen of screens) {
    assert.match(read(screen), /<SuccessToast message=\{notice\} \/>/);
  }
  const toast = read('../src/components/feedback/SuccessToast.tsx');
  assert.match(toast, /setTimeout\(\(\) => setVisible\(false\), 4000\)/);
  assert.match(toast, /clearTimeout\(timer\)/);
});

test('inventory catalog errors remain visible instead of becoming success toasts', () => {
  const inventory = read('../src/inventory/InventoryView.tsx');
  assert.match(inventory, /setCatalogError\('No se pudieron cargar los codificadores/);
  assert.match(inventory, /catalogError \? <p role="alert"/);
  assert.match(inventory, /<SuccessToast message=\{message\} \/>/);
});
