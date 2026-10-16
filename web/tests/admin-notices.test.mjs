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
