import { useMemo, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';

import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { TextField } from '@/components/forms/TextField';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { ModalShell } from '@/components/layout/ModalShell';
import type { MasterDataProvider } from '@/features/master-data/application/master-data.contracts';
import type { InventoryDemoProvider, InventoryDevicesGateway } from '../application/inventory.contracts';
import type { InventoryDeviceListItemDto } from '../application/devices.dto';
import type { DeviceAccountLock, DeviceDestination, DevicePhysicalCondition, DevicePowerState } from '../application/devices.dto';

type IntakeFormState = {
  brandId: string;
  deviceModelId: string;
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
    };
  };

  const [form, setForm] = useState<IntakeFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  function setField<Key extends keyof IntakeFormState>(key: Key, value: IntakeFormState[Key]) {
    setCreatedId(null);
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setBrand(brandId: string) {
    setCreatedId(null);
    setError(null);
    setForm((current) => ({ ...current, brandId, deviceModelId: '' }));
  }

  const selectedBrand = brands.find((brand) => brand.id === form.brandId);
  const selectedModel = deviceModels.find((model) => model.id === form.deviceModelId);
  const selectedStorage = storageCapacities.find((storage) => storage.id === form.storageCapacityId);
  const selectedColor = colors.find((color) => color.id === form.colorId);
  const selectedCondition = conditions.find((condition) => condition.id === form.conditionId);

  const canSubmit = Boolean(
    selectedBrand && selectedModel && selectedModel.brandId === form.brandId && Boolean(form.destination) && !saving,
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
        if (amountMinor !== null && amountMinor > 2147483647) throw new Error('El costo supera el importe máximo permitido.');
        await gateway.updateDevice(editDevice.inventoryId, {
          brandId: selectedBrand.id,
          deviceModelId: selectedModel.id,
          storageCapacityId: selectedStorage?.id ?? null,
          colorId: selectedColor?.id ?? null,
          conditionId: selectedCondition?.id ?? null,
          serialOrImei: form.serialOrImei.trim(),
          powersOn: form.powersOn,
          accountLock: form.accountLock,
          acquisitionSource: form.acquisitionSource.trim(),
          acquisitionCostMinor: amountMinor,
          currencyCode: currencyCode as 'UYU' | 'USD',
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
        description: form.notes.trim() || null,
        operational_status: operationalStatus(form.destination),
        publication_status: 'no_publicable',
        inventory_purpose: inventoryPurpose(form.destination),
        is_sellable: false,
        stock_quantity: 1,
        cost_amount_minor: amountMinor,
        sale_price_amount_minor: null,
        currency_code: currencyCode,
        metadata: {
          brand_id: selectedBrand.id,
          device_model_id: selectedModel.id,
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
        const body = await response.text();
        throw new Error(body || `No se pudo registrar el dispositivo (${response.status}).`);
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

  return <ModalShell title={editDevice ? 'Editar dispositivo ' + editDevice.id : view.title} onClose={onClose} disabled={saving}>
    <div className="p-2.5" data-device-intake data-device-mode={editDevice ? "edit" : "create"}>
      <form className="grid gap-2" onSubmit={submit}>
        <SurfaceCard className="!p-2">
          <h2 className="text-xs font-semibold text-slate-950">{editDevice ? 'Actualizar ficha de dispositivo' : 'Ingreso rápido de dispositivo'}</h2>
          <p className="mt-0.5 text-[11px] text-slate-600">{editDevice
            ? 'Usá el mismo catálogo del alta. El modelo depende de la marca seleccionada. El código FXP permanece igual.'
            : 'Marca, modelo y destino son suficientes para registrar el equipo. FixPhone le asignará un código FXP único. No necesitás IMEI.'}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <SelectField id="device-brand" label={view.fields.brandId} onChange={setBrand} options={brandOptions} value={form.brandId} />
            <SelectField id="device-model" label={view.fields.deviceModelId} onChange={(value) => setField('deviceModelId', value)} options={filteredModelOptions} value={form.deviceModelId} />
            <SelectField id="device-destination" label={view.fields.destination} disabled={Boolean(editDevice)} onChange={(value) => setField('destination', value as DeviceDestination)} options={view.options.destination} value={form.destination} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{editDevice
            ? 'Para cambiar el destino, usá la acción Cambiar estado del equipo o la ficha de evaluación técnica. Stock, código FXP y publicación se gestionan por separado.'
            : 'El dispositivo ingresa con stock inicial 1, sin habilitar venta ni publicación. Podrás completar identificación y diagnóstico después.'}</p>
          {editDevice && (!form.brandId || !form.deviceModelId) ? <p role="alert" className="mt-2 text-xs font-semibold text-amber-700">
            Este equipo no tiene una marca o modelo reconocido en el catálogo. Seleccioná ambos antes de guardar. No se modificarán datos hasta confirmarlo.
          </p> : null}
        </SurfaceCard>

        <details open={Boolean(editDevice)} className="rounded-lg border border-slate-200 bg-white" data-device-optional-details>
          <summary className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-800">Completar datos opcionales: IMEI, características, condición y costo</summary>
          <div className="grid gap-2 p-2 pt-0">
          <SurfaceCard className="!p-2">
            <h2 className="text-xs font-semibold text-slate-950">{view.identitySectionTitle}</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <TextField id="device-identity" label={view.fields.serialOrImei} onChange={(value) => setField('serialOrImei', value)} placeholder={view.placeholders.serialOrImei} value={form.serialOrImei} />
              <SelectField id="device-storage" label={view.fields.storageCapacityId} onChange={(value) => setField('storageCapacityId', value)} options={storageOptions} value={form.storageCapacityId} />
              <SelectField id="device-color" label={view.fields.colorId} onChange={(value) => setField('colorId', value)} options={colorOptions} value={form.colorId} />
            </div>
          </SurfaceCard>
          <SurfaceCard className="!p-2">
          <h2 className="text-xs font-semibold text-slate-950">{view.conditionSectionTitle}</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <SelectField id="device-powers-on" label={view.fields.powersOn} onChange={(value) => setField('powersOn', value as DevicePowerState)} options={view.options.powersOn} value={form.powersOn} />
            <SelectField id="device-condition" label={view.fields.conditionId} onChange={(value) => setField('conditionId', value)} options={conditionOptions} value={form.conditionId} />
            <SelectField id="device-lock" label={view.fields.accountLock} onChange={(value) => setField('accountLock', value as DeviceAccountLock)} options={view.options.accountLock} value={form.accountLock} />
          </div>
          {selectedCondition ? <p className="mt-3 text-xs text-slate-500" data-device-condition-hint>Condición canónica: {selectedCondition.name} · {selectedCondition.grade}</p> : null}
        </SurfaceCard>

        <SurfaceCard className="!p-2">
          <h2 className="text-xs font-semibold text-slate-950">{view.acquisitionSectionTitle}</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <TextField id="device-source" label={view.fields.acquisitionSource} onChange={(value) => setField('acquisitionSource', value)} placeholder={view.placeholders.acquisitionSource} value={form.acquisitionSource} />
            <TextField id="device-cost" label={view.fields.acquisitionCost} onChange={(value) => setField('acquisitionCost', value)} placeholder={view.placeholders.acquisitionCost} value={form.acquisitionCost} />
          </div>
        </SurfaceCard>

        <SurfaceCard className="!p-2">
          <h2 className="text-xs font-semibold text-slate-950">{view.routingSectionTitle}</h2>
          <div className="mt-2 grid gap-2">
            <TextAreaField id="device-notes" label={view.fields.notes} onChange={(value) => setField('notes', value)} placeholder={view.placeholders.notes} value={form.notes} />
          </div>
        </SurfaceCard>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2">
          <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" onClick={onClose} disabled={saving} type="button">
            {view.cancelLabel}
          </button>
          <button className="rounded-md bg-[var(--theme-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSubmit} type="submit">
            {saving ? 'Guardando...' : editDevice ? 'Guardar cambios' : 'Registrar dispositivo'}
          </button>
        </div>
      </form>
      
      {error ? <div className="mt-2"><InlineFeedback title={editDevice ? "No se pudo editar el dispositivo" : "No se pudo registrar el dispositivo"} message={error} tone="error" /></div> : null}
      
      {!editDevice && createdId ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Dispositivo registrado: {createdCode ?? createdId}. Puedes buscarlo en el listado.
        </div>
      ) : null}
    </div>
  </ModalShell>;
}
