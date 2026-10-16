import test from 'node:test';
import assert from 'node:assert/strict';
import { technicalSpecsPayload } from '../src/features/master-data/application/technicalSpecs.ts';

test('editing a compact field preserves unshown structured specifications', () => {
  const imported = { wifi: ' Wi-Fi 6 ', sensors: ['NFC', 'GPS'], dimensions: { width: 71 }, manufacturer: 'Samsung' };
  assert.deepEqual(technicalSpecsPayload(imported), { ...imported, wifi: 'Wi-Fi 6' });
  assert.equal(imported.wifi, ' Wi-Fi 6 ');
});
test('clearing a visible field removes only that field', () => {
  assert.deepEqual(technicalSpecsPayload({ wifi: '  ', sensors: { nfc: true } }), { sensors: { nfc: true } });
});
test('an empty draft is a valid empty payload', () => {
  assert.deepEqual(technicalSpecsPayload({}), {});
});
