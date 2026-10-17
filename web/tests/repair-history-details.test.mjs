import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
test('repair history has provenance and exact stock movement links without temporary diagnostics', () => {
  const modal = read('../src/features/inventory/presentation/DeviceRepairCostsModal.tsx');
  const backend = read('../../app/Presentation/Http/Controllers/DeviceInstalledPartsController.php');
  const migration = read('../../database/migrations/2026_10_17_000001_add_stock_adjustment_id_to_device_installed_parts.php');
  assert.doesNotMatch(modal, /Diagnosticar|diagnosticSku|part-compatibility-diagnostics/);
  for (const field of ['installed_at','installed_by_name','spare_part_sku','spare_part_origin','stock_adjustment_id']) {
    assert.match(modal, new RegExp(field));
  }
  assert.match(backend, /'stock_adjustment_id' => \$adjustmentId/);
  assert.match(backend, /'installed_by_name'/);
  assert.match(backend, /'spare_part_sku'/);
  assert.match(migration, /stock_adjustment_id/);
});
