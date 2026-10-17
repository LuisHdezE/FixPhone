import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('recovered pieces can circulate between devices without discarding origin traceability', () => {
  const controller = read('../../app/Presentation/Http/Controllers/DeviceInstalledPartsController.php');
  const diagnostic = read('../../app/Presentation/Http/Controllers/DevicePartCompatibilityDiagnosticController.php');
  assert.match(controller, /function ownershipAllowed\(/);
  assert.match(controller, /metadata\['origin'\].*'recovered'/);
  assert.match(controller, /device_part_extractions/);
  assert.match(controller, /\$this->ownershipAllowed\(\$device, \$part\)/);
  assert.match(controller, /!\$this->ownershipAllowed\(\$device, \$sparePartItem\)/);
  assert.match(diagnostic, /\$checker->ownershipAllowed\(\$device, \$part\)/);
});
