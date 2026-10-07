import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { TextField } from '@/components/forms/TextField';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { MasterDataProvider } from '@/features/master-data/application/master-data.contracts';
import type { InventoryDemoProvider } from '../application/inventory.contracts';
import type { DeviceAccountLock, DeviceDestination, DevicePowerState } from '../application/devices.dto';

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

export function InventoryDeviceIntakePage({ provider, masterDataProvider }: { provider: InventoryDemoProvider; masterDataProvider: MasterDataProvider }) {
  const view = provider.getDeviceIntakeView();
  const brands = useMemo(() => masterDataProvider.getBrands().filter((brand) => brand.active), [masterDataProvider]);
  const deviceModels = useMemo(() => masterDataProvider.getDeviceModels().filter((model) => model.active), [masterDataProvider]);
  const storageCapacities = useMemo(() => masterDataProvider.getStorageCapacities().filter((storage) => storage.active), [masterDataProvider]);
  const colors = useMemo(() => masterDataProvider.getColors().filter((color) => color.active), [masterDataProvider]);
  const conditions = useMemo(() => masterDataProvider.getConditions().filter((condition) => condition.active), [masterDataProvider]);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<IntakeFormState>(() => ({
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
  }));

  const brandOptions = useMemo(() => [
    { value: '', label: view.placeholders.brandId },
    ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
  ], [brands, view.placeholders.brandId]);

  const filteredModelOptions = useMemo(() => {
    const models = deviceModels.filter((model) => model.brandId === form.brandId);
    return [
      { value: '', label: form.brandId ? view.placeholders.deviceModelId.replace('primero una marca', 'un modelo') : view.placeholders.deviceModelId },
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
    setSubmitted(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setBrand(brandId: string) {
    setSubmitted(false);
    setForm((current) => ({ ...current, brandId, deviceModelId: '' }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  const canSubmit = Boolean(form.brandId && form.deviceModelId && form.storageCapacityId && form.colorId && form.conditionId && form.serialOrImei.trim());
  const selectedBrand = brands.find((brand) => brand.id === form.brandId);
  const selectedModel = deviceModels.find((model) => model.id === form.deviceModelId);
  const selectedStorage = storageCapacities.find((storage) => storage.id === form.storageCapacityId);
  const selectedColor = colors.find((color) => color.id === form.colorId);
  const selectedCondition = conditions.find((condition) => condition.id === form.conditionId);

  return <PageShell breadcrumbs={view.breadcrumbs.map((label) => ({ label }))} description={view.description} title={view.title}>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]" data-device-intake>
      <form className="grid gap-4" onSubmit={submit}>
        <SurfaceCard>
          <h2 className="text-base font-semibold text-slate-950">{view.identitySectionTitle}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SelectField id="device-brand" label={view.fields.brandId} onChange={setBrand} options={brandOptions} value={form.brandId} />
            <SelectField id="device-model" label={view.fields.deviceModelId} onChange={(value) => setField('deviceModelId', value)} options={filteredModelOptions} value={form.deviceModelId} />
            <TextField id="device-identity" label={view.fields.serialOrImei} onChange={(value) => setField('serialOrImei', value)} placeholder={view.placeholders.serialOrImei} value={form.serialOrImei} />
            <SelectField id="device-storage" label={view.fields.storageCapacityId} onChange={(value) => setField('storageCapacityId', value)} options={storageOptions} value={form.storageCapacityId} />
            <SelectField id="device-color" label={view.fields.colorId} onChange={(value) => setField('colorId', value)} options={colorOptions} value={form.colorId} />
          </div>
          {selectedBrand || selectedModel || selectedStorage || selectedColor ? <p className="mt-3 text-xs text-slate-500" data-device-master-data-hint>
            Referencia canónica: {[selectedBrand?.name, selectedModel?.name, selectedStorage?.label, selectedColor?.name].filter(Boolean).join(' · ')}
          </p> : null}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-base font-semibold text-slate-950">{view.conditionSectionTitle}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <SelectField id="device-powers-on" label={view.fields.powersOn} onChange={(value) => setField('powersOn', value)} options={view.options.powersOn} value={form.powersOn} />
            <SelectField id="device-condition" label={view.fields.conditionId} onChange={(value) => setField('conditionId', value)} options={conditionOptions} value={form.conditionId} />
            <SelectField id="device-lock" label={view.fields.accountLock} onChange={(value) => setField('accountLock', value)} options={view.options.accountLock} value={form.accountLock} />
          </div>
          {selectedCondition ? <p className="mt-3 text-xs text-slate-500" data-device-condition-hint>Condición canónica: {selectedCondition.name} · {selectedCondition.grade}</p> : null}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-base font-semibold text-slate-950">{view.acquisitionSectionTitle}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField id="device-source" label={view.fields.acquisitionSource} onChange={(value) => setField('acquisitionSource', value)} placeholder={view.placeholders.acquisitionSource} value={form.acquisitionSource} />
            <TextField id="device-cost" label={view.fields.acquisitionCost} onChange={(value) => setField('acquisitionCost', value)} placeholder={view.placeholders.acquisitionCost} value={form.acquisitionCost} />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-base font-semibold text-slate-950">{view.routingSectionTitle}</h2>
          <div className="mt-4 grid gap-4">
            <SelectField id="device-destination" label={view.fields.destination} onChange={(value) => setField('destination', value)} options={view.options.destination} value={form.destination} />
            <TextAreaField id="device-notes" label={view.fields.notes} onChange={(value) => setField('notes', value)} placeholder={view.placeholders.notes} value={form.notes} />
          </div>
        </SurfaceCard>

        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSubmit} type="submit">{view.submitLabel}</button>
          <Link className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900" to="/apps/inventory/devices">{view.cancelLabel}</Link>
        </div>
      </form>

      <aside className="grid content-start gap-4">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">{view.introTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{view.introDescription}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-sm leading-6 text-slate-500">{view.localNotice}</p>
        </SurfaceCard>
        {submitted ? <SurfaceCard>
          <div role="status" data-device-intake-success>
            <p className="text-sm font-semibold text-emerald-700">{view.successTitle}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{view.successMessage}</p>
          </div>
        </SurfaceCard> : null}
      </aside>
    </div>
  </PageShell>;
}
