import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('catalog edits do not resend unchanged brand/model identifiers', () => {
  const view = readFileSync(new URL('../src/inventory/InventoryView.tsx', import.meta.url), 'utf8');
  assert.match(view, /const changedCatalog = item\.itemType === 'spare_part'/);
  assert.match(view, /brand\.id !== item\.brandId \|\| model\.id !== item\.modelId/);
  assert.match(view, /\.\.\.\(changedCatalog/);
});
