import test from 'node:test';
import assert from 'node:assert/strict';

test('deviceModelVariantId is preserved as optional and distinct from physical attributes', () => {
  const itemWithVariant = {
    id: 'FXP-001',
    title: 'Samsung Galaxy S23 128GB',
    item_type: 'device',
    brand: 'Samsung',
    model: 'Galaxy S23',
    device_model_id: 'model-s23',
    device_model_variant_id: 'var-sm-s911b',
    metadata: {
      brand_id: 'brand-samsung',
      device_model_id: 'model-s23',
      device_model_variant_id: 'var-sm-s911b',
      serial_or_imei: '354890123456789',
      storage: '128 GB',
      color: 'Phantom Black',
    },
  };

  assert.equal(itemWithVariant.device_model_variant_id, 'var-sm-s911b');
  assert.equal(itemWithVariant.metadata.device_model_variant_id, 'var-sm-s911b');
  assert.equal(itemWithVariant.metadata.serial_or_imei, '354890123456789');

  const itemWithoutVariant = {
    id: 'FXP-002',
    title: 'Apple iPhone 14 128GB',
    item_type: 'device',
    brand: 'Apple',
    model: 'iPhone 14',
    device_model_id: 'model-ip14',
    device_model_variant_id: null,
    metadata: {
      brand_id: 'brand-apple',
      device_model_id: 'model-ip14',
      device_model_variant_id: null,
      serial_or_imei: '359876543210987',
      storage: '128 GB',
      color: 'Midnight',
    },
  };

  assert.equal(itemWithoutVariant.device_model_variant_id, null);
  assert.equal(itemWithoutVariant.metadata.device_model_variant_id, null);
});

test('inherited specs remain separated from unit verified attributes without mutation', () => {
  const catalogResolved = {
    model_id: 'model-s23',
    model_name: 'Galaxy S23',
    brand_id: 'brand-samsung',
    brand_name: 'Samsung',
    variant_id: 'var-sm-s911b',
    variant_name: 'SM-S911B (Global)',
    inherited_specs: {
      soc: 'Snapdragon 8 Gen 2',
      display_panel: 'Dynamic AMOLED 2X',
      battery_capacity_mah: 3900,
    },
    effective_specs: {
      soc: 'Snapdragon 8 Gen 2',
      display_panel: 'Dynamic AMOLED 2X',
      battery_capacity_mah: 3900,
      modem: 'Global 5G Sub6',
    },
  };

  const physicalUnit = {
    serial_or_imei: '354890123456789',
    storage: '256 GB',
    color: 'Green',
    battery_health: 94,
  };

  // Combining for read-only view does not pollute the physical unit state
  const viewState = {
    ...physicalUnit,
    catalogSpecs: catalogResolved.effective_specs,
  };

  assert.equal(viewState.serial_or_imei, '354890123456789');
  assert.equal(viewState.catalogSpecs.soc, 'Snapdragon 8 Gen 2');
  assert.equal(viewState.catalogSpecs.modem, 'Global 5G Sub6');
  assert.equal(Object.keys(physicalUnit).includes('soc'), false);
});
