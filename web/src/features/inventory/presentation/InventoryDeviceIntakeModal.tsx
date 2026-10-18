import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';

import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { TextField } from '@/components/forms/TextField';
import { ModalShell } from '@/components/layout/ModalShell';
import { DevicePhotoGallery } from './DevicePhotoGallery';
import type { MasterDataProvider } from '@/features/master-data/application/master-data.contracts';
import type { InventoryDemoProvider, InventoryDevicesGateway } from '../application/inventory.contracts';
import type {
  DeviceAccountLock,
  DeviceDestination,
  DeviceModelResolvedSpecsResponseDto,
  DeviceModelVariantOptionDto,
  DevicePhysicalCondition,
  DevicePowerState,
  InventoryDeviceListItemDto,
} from '../application/devices.dto';

type IntakeFormState = {
  brandId: string;
  deviceModelId: string;
  deviceModelVariantId: string;
  serialOrImei: string;
  storageCapacityId: string;
  colorId: string;
  conditionId: string;
  powersOn: DevicePowerState;
  accountLock: DeviceAccountLock;
  acquisitionSource: string;
  acquisitionCost: string;
  destination: DeviceDestination;
  notes: string;
  ownershipType: 'owned' | 'consignment';
  consignorId: string;
  ownershipCorrectionReason: string;
};

function mapCondition(grade: string | undefined): DevicePhysicalCondition {
  switch (grade) {
    case 'N':
    case 'OB':
      return 'Excellent';
    case 'A':
      return 'Good';
    case 'B':
      return 'Fair';
    case 'PARTS':
      return 'Damaged';
    default:
      return 'Unknown';
  }
}

function operationalStatus(destination: DeviceDestination): string {
  switch (destination) {
    case 'Donor':
      return 'para_deshuesar';
    case 'Refurbish':
      return 'para_reparar';
    case 'Discard':
      return 'descartado';
    case 'Hold':
      return 'ingresado';
    default:
      return 'ingresado';
  }
}

function inventoryPurpose(destination: DeviceDestination): string {
  switch (destination) {
    case 'Donor':
      return 'parts_donor';
    case 'Refurbish':
      return 'repair_then_sell';
    case 'Discard':
      return 'discard';
    case 'Hold':
      return 'internal_use';
    default:
      return 'internal_use';
  }
}

function parseAcquisitionCost(raw: string): { amountMinor: number | null; currencyCode: string } {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return { amountMinor: null, currencyCode: 'UYU' };

  const currencyCode = normalized.startsWith('USD') ? 'USD' : 'UYU';
  const numeric = normalized
    .replace(/^(USD|UYU)\s*/i, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const amount = Number(numeric);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('El costo debe ser un importe válido, por ejemplo "USD 120" o "4500".');
  }

  return { amountMinor: Math.round(amount * 100), currencyCode };
}

function catalogId<T extends { id: string }>(
  storedId: string | null,
  storedLabel: string,
  items: readonly T[],
  label: (item: T) => string,
): string {
  if (storedId && items.some((item) => item.id === storedId)) return storedId;
  const matches = items.filter((item) => label(item).trim().toLowerCase() === storedLabel.trim().toLowerCase());
  return matches.length === 1 ? matches[0]?.id ?? '' : '';
}

type DeviceModalProps = {
  provider: InventoryDemoProvider;
  masterDataProvider: MasterDataProvider;
  onClose: () => void;
  onCreated?: (message: string) => void;
  editDevice?: InventoryDeviceListItemDto;
  gateway?: InventoryDevicesGateway;
  onSaved?: (message: string) => void;
};

export function InventoryDeviceIntakeModal({ provider, masterDataProvider, onClose, onCreated, editDevice, gateway, onSaved }: DeviceModalProps) {
  const view = provider.getDeviceIntakeView();
  const brands = useMemo(() => masterDataProvider.getBrands().filter((brand) => brand.active), [masterDataProvider]);
  const deviceModels = useMemo(() => masterDataProvider.getDeviceModels().filter((model) => model.active), [masterDataProvider]);
  const storageCapacities = useMemo(() => masterDataProvider.getStorageCapacities().filter((storage) => storage.active), [masterDataProvider]);
  const colors = useMemo(() => masterDataProvider.getColors().filter((color) => color.active), [masterDataProvider]);
  const conditions = useMemo(() => masterDataProvider.getConditions().filter((condition) => condition.active), [masterDataProvider]);

  const initialForm = (): IntakeFormState => {
    if (!editDevice) {
      return {
        brandId: view.defaults.brandId,
        deviceModelId: view.defaults.deviceModelId,
        deviceModelVariantId: '',
        serialOrImei: '',
        storageCapacityId: view.defaults.storageCapacityId,
        colorId: view.defaults.colorId,
        conditionId: view.defaults.conditionId,
        powersOn: view.defaults.powersOn,
        accountLock: view.defaults.accountLock,
        acquisitionSource: '',
        acquisitionCost: '',
        destination: view.defaults.destination,
        notes: '',
        ownershipType: 'owned',
        consignorId: '',
        ownershipCorrectionReason: '',
      };
    }
    const brandId = catalogId(editDevice.brandId, editDevice.manufacturer, brands, (brand) => brand.name);
    const modelOptions = deviceModels.filter((model) => model.brandId === brandId);
    const modelId = catalogId(editDevice.deviceModelId, editDevice.model, modelOptions, (model) => model.name);
    const potentialConditions = conditions.filter((condition) => mapCondition(condition.grade) === editDevice.physicalCondition);
    const conditionId = editDevice.conditionId && conditions.some((c) => c.id === editDevice.conditionId)
      ? editDevice.conditionId
      : potentialConditions.length === 1 ? potentialConditions[0]?.id ?? '' : '';
    return {
      brandId,
      deviceModelId: modelId,
      deviceModelVariantId: editDevice.deviceModelVariantId ?? '',
      serialOrImei: editDevice.serialOrImei === '—' ? '' : editDevice.serialOrImei,
      storageCapacityId: catalogId(editDevice.storageCapacityId, editDevice.storage, storageCapacities, (storage) => storage.label),
      colorId: catalogId(editDevice.colorId, editDevice.color, colors, (color) => color.name),
      conditionId,
      powersOn: editDevice.powersOn,
      accountLock: editDevice.accountLock,
      acquisitionSource: editDevice.acquisitionSource === '—' ? '' : editDevice.acquisitionSource,
      acquisitionCost: editDevice.acquisitionCostMinor === null
        ? '' : (editDevice.currencyCode === 'USD' ? 'USD ' : '') + (editDevice.acquisitionCostMinor / 100).toFixed(2),
      destination: editDevice.destination,
      notes: editDevice.description,
      ownershipType: editDevice.ownershipType,
      consignorId: editDevice.consignorId ?? '',
      ownershipCorrectionReason: '',
    };
  };

  const [form, setForm] = useState<IntakeFormState>(initialForm);
  const initialEditForm = useMemo(() => editDevice ? initialForm() : null, [editDevice]);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consignorsLoading, setConsignorsLoading] = useState(false);
  const [consignorsError, setConsignorsError] = useState<string | null>(null);
  const [consignors, setConsignors] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (!editDevice && form.ownershipType !== 'consignment') return;
    let alive = true;
    setConsignorsLoading(true);
    setConsignorsError(null);
    adminFetch('/api/v1/admin/consignors', { headers: { Accept: 'application/json' } })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo cargar el catálogo de consignantes.');
        return response.json() as Promise<{ data: { id: string; full_name: string }[] }>;
      })
      .then(payload => { if (alive) setConsignors(payload.data); })
      .catch(() => { if (alive) setConsignorsError('No se pudo cargar el catálogo de consignantes. Volvé a seleccionar En consignación para reintentar.'); })
      .finally(() => { if (alive) setConsignorsLoading(false); });
    return () => { alive = false; };
  }, [editDevice, form.ownershipType]);

  const brandOptions = useMemo(() => [
    { value: '', label: view.placeholders.brandId },
    ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
  ], [brands, view.placeholders.brandId]);

  const filteredModelOptions = useMemo(() => {
    const models = deviceModels.filter((model) => model.brandId === form.brandId);
    return [
      { value: '', label: form.brandId ? 'Selecciona un modelo' : view.placeholders.deviceModelId },
      ...models.map((model) => ({ value: model.id, label: model.name })),
    ];
  }, [deviceModels, form.brandId, view.placeholders.deviceModelId]);

  const storageOptions = useMemo(() => [
    { value: '', label: view.placeholders.storageCapacityId },
    ...storageCapacities.map((storage) => ({ value: storage.id, label: storage.label })),
  ], [storageCapacities, view.placeholders.storageCapacityId]);

  const colorOptions = useMemo(() => [
    { value: '', label: view.placeholders.colorId },
    ...colors.map((color) => ({ value: color.id, label: color.name })),
  ], [colors, view.placeholders.colorId]);

  const conditionOptions = useMemo(() => [
    { value: '', label: view.placeholders.conditionId },
    ...conditions.map((condition) => ({ value: condition.id, label: condition.name })),
  ], [conditions, view.placeholders.conditionId]);

  const [variantOptions, setVariantOptions] = useState<readonly DeviceModelVariantOptionDto[]>([]);
  const [resolvedSpecs, setResolvedSpecs] = useState<Record<string, unknown> | null>(null);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsError, setSpecsError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.deviceModelId) {
      setVariantOptions([]);
      setResolvedSpecs(null);
      setSpecsError(null);
      return;
    }
    let alive = true;
    setSpecsLoading(true);
    setSpecsError(null);
    const query = form.deviceModelVariantId ? `?variant_id=${encodeURIComponent(form.deviceModelVariantId)}` : '';
    adminFetch(`/api/v1/admin/device-models/${encodeURIComponent(form.deviceModelId)}/resolved-specs${query}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          const errPayload = await res.json().catch(() => null) as { message?: string } | null;
          throw new Error(errPayload?.message || `Error al consultar la ficha técnica (${res.status})`);
        }
        return res.json() as Promise<DeviceModelResolvedSpecsResponseDto>;
      })
      .then((payload) => {
        if (!alive) return;
        setVariantOptions(payload.data.variants || []);
        const effective = payload.data.resolved?.effective ?? payload.data.resolved?.effective_specs ?? null;
        setResolvedSpecs(effective && Object.keys(effective).length > 0 ? effective : null);
        setSpecsError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setSpecsError(err instanceof Error ? err.message : 'No se pudo cargar la ficha técnica del catálogo.');
        setResolvedSpecs(null);
      })
      .finally(() => {
        if (alive) setSpecsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [form.deviceModelId, form.deviceModelVariantId]);

  function setField<Key extends keyof IntakeFormState>(key: Key, value: IntakeFormState[Key]) {
    setCreatedId(null);
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setBrand(brandId: string) {
    setCreatedId(null);
    setError(null);
    setVariantOptions([]);
    setResolvedSpecs(null);
    setSpecsError(null);
    setForm((current) => ({ ...current, brandId, deviceModelId: '', deviceModelVariantId: '' }));
  }

  function setDeviceModel(deviceModelId: string) {
    setCreatedId(null);
    setError(null);
    setVariantOptions([]);
    setResolvedSpecs(null);
    setSpecsError(null);
    setForm((current) => ({ ...current, deviceModelId, deviceModelVariantId: '' }));
  }

  const selectedBrand = brands.find((brand) => brand.id === form.brandId);
  const selectedModel = deviceModels.find((model) => model.id === form.deviceModelId);
  const selectedStorage = storageCapacities.find((storage) => storage.id === form.storageCapacityId);
  const selectedColor = colors.find((color) => color.id === form.colorId);
  const selectedCondition = conditions.find((condition) => condition.id === form.conditionId);

  const hasFormChanges = !editDevice || !initialEditForm || JSON.stringify(form) !== JSON.stringify(initialEditForm);

  const canSubmit = Boolean(
    selectedBrand && selectedModel && selectedModel.brandId === form.brandId && Boolean(form.destination) && !saving
      && (form.ownershipType === 'owned' || (!consignorsLoading && !consignorsError && consignors.some(item => item.id === form.consignorId))),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !selectedBrand || !selectedModel) return;

    setSaving(true);
    setCreatedId(null);
    setCreatedCode(null);
    setError(null);

    try {
      const { amountMinor, currencyCode } = parseAcquisitionCost(form.acquisitionCost);
      if (editDevice) {
        if (!gateway || !onSaved) throw new Error('No se pudo iniciar la edición del dispositivo.');
        if (!hasFormChanges) {
          onClose();
          return;
        }
        if (amountMinor !== null && amountMinor > 2147483647) throw new Error('El costo supera el importe máximo permitido.');
        await gateway.updateDevice(editDevice.inventoryId, {
          brandId: selectedBrand.id,
          deviceModelId: selectedModel.id,
          deviceModelVariantId: form.deviceModelVariantId || null,
          storageCapacityId: selectedStorage?.id ?? null,
          colorId: selectedColor?.id ?? null,
          conditionId: selectedCondition?.id ?? null,
          serialOrImei: form.serialOrImei.trim(),
          powersOn: form.powersOn,
          accountLock: form.accountLock,
          acquisitionSource: form.acquisitionSource.trim(),
          acquisitionCostMinor: amountMinor,
          currencyCode: currencyCode as 'UYU' | 'USD',
          ownershipType: form.ownershipType,
          consignorId: form.ownershipType === 'consignment' ? form.consignorId || null : null,
          ownershipCorrectionReason: form.ownershipCorrectionReason.trim(),
          description: form.notes.trim(),
        });
        onSaved('Equipo ' + editDevice.id + ' actualizado correctamente.');
        return;
      }
      const payload = {
        title: [selectedBrand.name, selectedModel.name, selectedStorage?.label].filter(Boolean).join(' '),
        item_type: 'used_phone',
        brand: selectedBrand.name,
        model: selectedModel.name,
        device_model_id: selectedModel.id,
        device_model_variant_id: form.deviceModelVariantId || null,
        description: form.notes.trim() || null,
        operational_status: operationalStatus(form.destination),
        publication_status: 'no_publicable',
        inventory_purpose: form.ownershipType === 'consignment' ? 'consignation' : inventoryPurpose(form.destination),
        ownership_type: form.ownershipType,
        consignor_id: form.ownershipType === 'consignment' ? form.consignorId : null,
        is_sellable: false,
        stock_quantity: 1,
        cost_amount_minor: amountMinor,
        sale_price_amount_minor: null,
        currency_code: currencyCode,
        metadata: {
          brand_id: selectedBrand.id,
          device_model_id: selectedModel.id,
          device_model_variant_id: form.deviceModelVariantId || null,
          serial_or_imei: form.serialOrImei.trim() || null,
          storage_capacity_id: selectedStorage?.id ?? null,
          storage: selectedStorage?.label ?? null,
          color_id: selectedColor?.id ?? null,
          color: selectedColor?.name ?? null,
          condition_id: selectedCondition?.id ?? null,
          condition_grade: selectedCondition?.grade ?? null,
          condition_name: selectedCondition?.name ?? null,
          physical_condition: mapCondition(selectedCondition?.grade),
          powers_on: form.powersOn,
          account_lock: form.accountLock,
          acquisition_source: form.acquisitionSource.trim() || null,
          destination: form.destination,
          notes: form.notes.trim() || null,
        },
      };

      const response = await adminFetch('/api/v1/admin/inventory', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
        const message = body?.errors ? Object.values(body.errors).flat().join(' ') : body?.message;
        throw new Error(message || `No se pudo registrar el dispositivo (${response.status}).`);
      }

      const created = await response.json() as { id?: string; sku?: string | null };
      setCreatedId(created.id ?? 'registrado');
      setCreatedCode(created.sku ?? null);
      setForm(initialForm());
      onCreated?.(`Dispositivo registrado exitosamente: ${created.sku ?? created.id ?? 'registrado'}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar el dispositivo.');
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell title={editDevice ? 'Editar dispositivo ' + editDevice.id : view.title} onClose={onClose} disabled={saving} hideCloseButton density="compact" width="medium">
    <form className="device-intake-form grid gap-2 p-3" data-device-intake data-device-mode={editDevice ? 'edit' : 'create'} onSubmit={submit}>
      <p className="text-[11px] leading-4 text-slate-500">{editDevice
        ? 'El código FXP se conserva. El destino se modifica desde Cambiar estado.'
        : 'Marca, modelo y destino son obligatorios. Código FXP automático; IMEI opcional.'}</p>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1 text-[11px] font-semibold text-slate-900">Equipo</legend>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1.2fr]">
          <SelectField id="device-brand" label={view.fields.brandId} onChange={setBrand} options={brandOptions} value={form.brandId} />
          <SelectField id="device-model" label={view.fields.deviceModelId} onChange={setDeviceModel} options={filteredModelOptions} value={form.deviceModelId} />
          <SelectField id="device-destination" label={view.fields.destination} disabled={Boolean(editDevice)} onChange={(value) => setField('destination', value as DeviceDestination)} options={view.options.destination} value={form.destination} />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <SelectField
            id="device-variant"
            label="Variante comercial (opcional)"
            disabled={!form.deviceModelId || variantOptions.length === 0}
            onChange={(value) => setField('deviceModelVariantId', value)}
            options={[
              {
                value: '',
                label: !form.deviceModelId
                  ? 'Seleccioná un modelo primero'
                  : variantOptions.length === 0
                  ? 'Sin variantes registradas (modelo genérico)'
                  : 'Sin especificar variante (opcional)',
              },
              ...variantOptions.map((v) => ({
                value: v.id,
                label: v.name + (v.variant_key ? ` (${v.variant_key})` : ''),
              })),
            ]}
            value={form.deviceModelVariantId}
          />
        </div>
        {selectedModel && (
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 p-2 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-[11px] font-semibold text-slate-800">
                Ficha técnica heredada del catálogo (solo lectura)
              </span>
              {specsLoading && <span className="text-[10px] text-slate-500">Cargando…</span>}
            </div>
            {specsError ? (
              <p role="alert" className="mt-1 text-[11px] text-amber-700">
                Aviso: {specsError}
              </p>
            ) : resolvedSpecs && Object.keys(resolvedSpecs).length > 0 ? (
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-3">
                {Object.entries(resolvedSpecs).slice(0, 6).map(([key, val]) => (
                  <div key={key} className="truncate">
                    <span className="font-medium capitalize text-slate-500">{key.replace(/_/g, ' ')}:</span>{' '}
                    <span className="text-slate-800">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            ) : !specsLoading ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Sin especificaciones técnicas base en catálogo para este modelo. Los atributos particulares de la unidad física se definen abajo.
              </p>
            ) : null}
          </div>
        )}
        {editDevice && (!form.brandId || !form.deviceModelId) ? <p role="alert" className="mt-1 text-[11px] text-amber-700">Seleccioná una marca y un modelo válidos del catálogo antes de guardar.</p> : null}
      </fieldset>
      <fieldset className="min-w-0 border-0 border-t border-slate-100 p-0 pt-2">
        <legend className="text-[11px] font-semibold text-slate-900">Identificación</legend>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <TextField id="device-identity" label={view.fields.serialOrImei} onChange={(value) => setField('serialOrImei', value)} placeholder="IMEI o número de serie" value={form.serialOrImei} />
          <SelectField id="device-storage" label={view.fields.storageCapacityId} onChange={(value) => setField('storageCapacityId', value)} options={storageOptions} value={form.storageCapacityId} />
          <SelectField id="device-color" label={view.fields.colorId} onChange={(value) => setField('colorId', value)} options={colorOptions} value={form.colorId} />
        </div>
      </fieldset>
      <fieldset className="min-w-0 border-0 border-t border-slate-100 p-0 pt-2">
        <legend className="text-[11px] font-semibold text-slate-900">Estado</legend>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1.2fr]">
          <SelectField id="device-powers-on" label={view.fields.powersOn} onChange={(value) => setField('powersOn', value as DevicePowerState)} options={view.options.powersOn} value={form.powersOn} />
          <SelectField id="device-condition" label={view.fields.conditionId} onChange={(value) => setField('conditionId', value)} options={conditionOptions} value={form.conditionId} />
          <SelectField id="device-lock" label={view.fields.accountLock} onChange={(value) => setField('accountLock', value as DeviceAccountLock)} options={view.options.accountLock} value={form.accountLock} />
        </div>
      </fieldset>
      <fieldset className="min-w-0 border-0 border-t border-slate-100 p-0 pt-2">
        <legend className="text-[11px] font-semibold text-slate-900">Adquisición</legend>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_1fr]">
          <SelectField id="device-ownership" label="Propiedad" value={form.ownershipType} onChange={value => { setField('ownershipType', value as 'owned' | 'consignment'); setField('consignorId', ''); }} options={[{ value: 'owned', label: 'Propio' }, { value: 'consignment', label: 'En consignación' }]} />
          <TextField id="device-source" label={view.fields.acquisitionSource} onChange={(value) => setField('acquisitionSource', value)} placeholder={view.placeholders.acquisitionSource} value={form.acquisitionSource} />
          <TextField id="device-cost" label={view.fields.acquisitionCost} onChange={(value) => setField('acquisitionCost', value)} placeholder="UYU 4500 / USD 120" value={form.acquisitionCost} />
        </div>
        <div className={form.ownershipType === 'consignment' || (editDevice && form.ownershipType !== editDevice.ownershipType) ? 'mt-2 grid gap-2 sm:grid-cols-2' : 'contents'}>
          {form.ownershipType === 'consignment' && <SelectField id="device-consignor" label="Consignante (obligatorio)" disabled={consignorsLoading} value={form.consignorId} onChange={value => setField('consignorId', value)} options={[{ value: '', label: 'Seleccionar consignante' }, ...consignors.map(item => ({ value: item.id, label: item.full_name }))]} />}
          {editDevice && (form.ownershipType !== editDevice.ownershipType || (form.ownershipType === 'consignment' && form.consignorId !== (editDevice.consignorId ?? ''))) && <div className="sm:col-span-2"><TextAreaField id="device-ownership-reason" rows={2} label="Motivo de corrección de titularidad" value={form.ownershipCorrectionReason} onChange={value => setField('ownershipCorrectionReason', value)} placeholder="Ej.: se registró como propio por error" /></div>}
          {form.ownershipType === 'consignment' && consignorsLoading ? <p role="status" className="text-[11px] text-slate-500">Cargando consignantes…</p> : null}
          {form.ownershipType === 'consignment' && consignorsError ? <p role="alert" className="text-[11px] text-red-700">{consignorsError}</p> : null}
          {form.ownershipType === 'consignment' && !consignorsLoading && !consignorsError && consignors.length === 0 ? <p className="text-[11px] text-amber-700">Registrá primero al propietario en Consignantes.</p> : null}
        </div>
      </fieldset>
      <TextAreaField id="device-notes" rows={2} label={view.fields.notes} onChange={(value) => setField('notes', value)} placeholder={view.placeholders.notes} value={form.notes} />
      {editDevice ? <div className="grid gap-1"><DevicePhotoGallery inventoryId={editDevice.inventoryId} /><p className="text-[10px] text-emerald-700">Las fotos se guardan automáticamente. No necesitás pulsar Guardar después de añadir, ordenar o eliminar imágenes.</p></div> : null}
      {error ? <InlineFeedback title={editDevice ? 'No se pudo editar el dispositivo' : 'No se pudo registrar el dispositivo'} message={error} tone="error" /> : null}
      {!editDevice && createdId ? <p role="status" className="text-xs text-emerald-800">Dispositivo registrado: {createdCode ?? createdId}.</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
        <button className="h-7 rounded-md border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50" onClick={onClose} disabled={saving} type="button">Cancelar</button>
        <button className="h-7 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-medium text-white hover:brightness-95 disabled:opacity-50" disabled={!canSubmit} aria-busy={saving} type="submit">{editDevice && !hasFormChanges ? 'Cerrar' : 'Guardar'}</button>
      </div>
    </form>
  </ModalShell>;
}
