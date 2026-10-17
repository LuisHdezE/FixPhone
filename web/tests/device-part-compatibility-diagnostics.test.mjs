import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('repair diagnostics are read-only and explain unavailable spare parts', () => {
  const backend = read('../../app/Presentation/Http/Controllers/DevicePartCompatibilityDiagnosticController.php');
  const repair = read('../src/features/inventory/presentation/DeviceRepairCostsModal.tsx');
  const routes = read('../../routes/api.php');
  assert.match(backend, /model_mismatch/);
  assert.match(backend, /owner_mismatch/);
  assert.match(backend, /out_of_stock/);
  assert.match(backend, /reserved_stock/);
  assert.doesNotMatch(repair, /Diagnosticar/);
  assert.match(routes, /part-compatibility-diagnostics/);
  assert.match(routes, /permission:inventory.view/);
});
