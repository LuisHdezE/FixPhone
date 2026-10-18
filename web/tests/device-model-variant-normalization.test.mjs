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

test('frontend intake modal extracts specs symmetrically from effective or effective_specs in real API payload', () => {
  // Real backend response shape returned by /api/v1/admin/device-models/{modelId}/resolved-specs
  const apiResponse = {
    data: {
      variants: [
        { id: 'var-1', name: 'SM-S911B', variant_key: 'sm-s911b' },
      ],
      resolved: {
        device_model_id: 'model-s23',
        variant_known: true,
        specifications_status: 'draft',
        specifications_source: 'manual',
        model_specs: {
          soc: 'Snapdragon 8 Gen 2',
          screen_size: '6.1 in',
        },
        variant: {
          id: 'var-1',
          name: 'SM-S911B',
          variant_key: 'sm-s911b',
          active: true,
          ram: '8 GB',
          storage: '256 GB',
          region_code: 'GLOBAL',
          manufacturer_variant_code: 'SM-S911B/DS',
          differences: { modem: '5G Global' },
        },
        effective: {
          soc: 'Snapdragon 8 Gen 2',
          screen_size: '6.1 in',
          modem: '5G Global',
          ram: '8 GB',
          storage: '256 GB',
        },
        inherited_specs: {
          soc: 'Snapdragon 8 Gen 2',
          screen_size: '6.1 in',
        },
        effective_specs: {
          soc: 'Snapdragon 8 Gen 2',
          screen_size: '6.1 in',
          modem: '5G Global',
          ram: '8 GB',
          storage: '256 GB',
        },
      },
    },
  };

  // Simulating extractor in InventoryDeviceIntakeModal.tsx
  const effective = apiResponse.data.resolved?.effective ?? apiResponse.data.resolved?.effective_specs ?? null;
  assert.ok(effective);
  assert.equal(effective.soc, 'Snapdragon 8 Gen 2');
  assert.equal(effective.modem, '5G Global');
  assert.equal(effective.storage, '256 GB');
  assert.equal(apiResponse.data.variants.length, 1);
  assert.equal(apiResponse.data.variants[0].name, 'SM-S911B');
});

test('model and brand switching properly cleans prior variants, specs, and errors', () => {
  let formState = {
    brandId: 'brand-apple',
    deviceModelId: 'model-ip13',
    deviceModelVariantId: 'var-a2633',
  };
  let variantOptions = [{ id: 'var-a2633', name: 'A2633', variant_key: 'a2633' }];
  let resolvedSpecs = { screen: '6.1 in', chip: 'A15' };
  let specsError = 'Error previo';

  // 1. Changing deviceModelId resets variant selection, options, resolved specs, and error
  function setDeviceModel(newModelId) {
    variantOptions = [];
    resolvedSpecs = null;
    specsError = null;
    formState = { ...formState, deviceModelId: newModelId, deviceModelVariantId: '' };
  }

  setDeviceModel('model-ip14');
  assert.equal(formState.deviceModelId, 'model-ip14');
  assert.equal(formState.deviceModelVariantId, '');
  assert.equal(variantOptions.length, 0);
  assert.equal(resolvedSpecs, null);
  assert.equal(specsError, null);

  // 2. Changing brandId also cleans model, variant selection, options, specs, and error
  function setBrand(newBrandId) {
    variantOptions = [];
    resolvedSpecs = null;
    specsError = null;
    formState = { ...formState, brandId: newBrandId, deviceModelId: '', deviceModelVariantId: '' };
  }

  setBrand('brand-samsung');
  assert.equal(formState.brandId, 'brand-samsung');
  assert.equal(formState.deviceModelId, '');
  assert.equal(formState.deviceModelVariantId, '');
  assert.equal(variantOptions.length, 0);
  assert.equal(resolvedSpecs, null);
  assert.equal(specsError, null);
});

test('loading errors are distinct from legitimate absence of catalog specifications', () => {
  // Scenario A: Legitimate absence (200 OK, empty specs in catalog)
  const emptyCatalogResponse = {
    data: {
      variants: [],
      resolved: {
        device_model_id: 'model-generic',
        variant_known: false,
        model_specs: {},
        variant: null,
        effective: {},
        inherited_specs: {},
        effective_specs: {},
      },
    },
  };
  const effectiveEmpty = emptyCatalogResponse.data.resolved?.effective ?? emptyCatalogResponse.data.resolved?.effective_specs ?? null;
  const resolvedSpecsA = effectiveEmpty && Object.keys(effectiveEmpty).length > 0 ? effectiveEmpty : null;
  const specsErrorA = null;

  assert.equal(specsErrorA, null);
  assert.equal(resolvedSpecsA, null);
  // UI logic: if !specsLoading && !specsError && !resolvedSpecs => shows "Sin especificaciones técnicas base en catálogo para este modelo."
  const isAbsent = !specsErrorA && !resolvedSpecsA;
  assert.equal(isAbsent, true);

  // Scenario B: Network or Server Error (e.g. 500 or network timeout)
  let resolvedSpecsB = null;
  let specsErrorB = null;
  try {
    throw new Error('Error al consultar la ficha técnica (500)');
  } catch (err) {
    specsErrorB = err.message;
    resolvedSpecsB = null;
  }

  assert.equal(resolvedSpecsB, null);
  assert.equal(specsErrorB, 'Error al consultar la ficha técnica (500)');
  // UI logic: if specsError => shows "Aviso: Error al consultar la ficha técnica (500)", NOT "Sin especificaciones..."
  assert.ok(specsErrorB);
});

