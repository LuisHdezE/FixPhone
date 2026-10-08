import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { TextField } from '@/components/forms/TextField';
import { PageShell } from '@/shell/PageShell';
import type { MasterDataGateway, MasterDataKind, MasterDataProvider } from '../application/master-data.contracts';

type ExtendedMasterDataKind = Extract<MasterDataKind, 'colors' | 'storageCapacities' | 'ramCapacities' | 'conditions' | 'sparePartTypes'>;
type Notice = { tone: 'success' | 'warning'; message: string } | null;
type ConfirmAction = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'warning' | 'danger';
  onConfirm: () => Promise<void>;
} | null;

type SimpleMasterDataItem = {
  id: string;
  name: string;
  slug: string;
  value: string;
  description: string;
  parentId: string | null;
  active: boolean;
  sortOrder: number;
};

type SimpleFormState = Omit<SimpleMasterDataItem, 'id'> & { id?: string };

type SimpleMasterDataConfig = {
  kind: ExtendedMasterDataKind;
  title: string;
  description: string;
  createLabel: string;
  singularLabel: string;
  dataAttribute: string;
  valueLabel: string;
  valuePlaceholder: string;
  descriptionLabel?: string;
  supportsSlug?: boolean;
  supportsParent?: boolean;
  supportsDescription?: boolean;
  parentLabel?: string;
  initialItems: readonly SimpleMasterDataItem[];
};

interface ExtendedPageProps {
  masterDataProvider: MasterDataProvider;
  gateway: MasterDataGateway;
  onChanged: () => Promise<void>;
}

const status = (active: boolean) => <StatusBadge label={active ? 'Activo' : 'Inactivo'} tone={active ? 'success' : 'neutral'} />;

function normalizeSlug(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function toSortOrder(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textSearch(values: readonly (string | number | null | undefined)[]) {
  return values.filter((value) => value !== null && value !== undefined).join(' ');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo guardar el cambio.';
}

function AdminNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <div className={`rounded-md border px-3 py-2 text-xs ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`} role="status">{notice.message}</div>;
}

function PersistenceNote() {
  return <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-4 text-emerald-700">Conectado a la API. Los cambios se guardan de forma permanente en la base de datos.</p>;
}

function ModalShell({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3" role="dialog" aria-modal="true" aria-label={title}>
    <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" onClick={onClose} type="button">Cerrar</button>
      </div>
      {children}
    </div>
  </div>;
}

function FormModal({ title, children, onSubmit, onCancel, submitLabel, error }: { title: string; children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; submitLabel: string; error?: string | null }) {
  return <ModalShell title={title} onClose={onCancel}>
    <form className="p-4" data-extended-master-data-form onSubmit={onSubmit}>
      {error ? <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" role="alert">{error}</div> : null}
      <div className="grid gap-2 md:grid-cols-2">{children}</div>
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" onClick={onCancel} type="button">Cancelar</button>
        <button className="rounded-md bg-[var(--theme-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95" type="submit">{submitLabel}</button>
      </div>
    </form>
  </ModalShell>;
}

function ConfirmDialog({ action, onCancel }: { action: ConfirmAction; onCancel: () => void }) {
  if (!action) return null;
  const buttonClass = action.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700';
  return <ModalShell title={action.title} onClose={onCancel}>
    <div className="p-4">
      <p className="text-xs leading-5 text-slate-600">{action.message}</p>
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50" onClick={onCancel} type="button">Cancelar</button>
        <button className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition ${buttonClass}`} onClick={() => void action.onConfirm()} type="button">{action.confirmLabel}</button>
      </div>
    </div>
  </ModalShell>;
}

function ActionButton({ children, onClick, tone = 'neutral' }: { children: ReactNode; onClick: () => void; tone?: 'neutral' | 'warning' | 'danger' }) {
  const classes = tone === 'danger' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : tone === 'warning' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50';
  return <button className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${classes}`} onClick={onClick} type="button">{children}</button>;
}

function BooleanSelect({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <SelectField id={id} label={label} onChange={(next) => onChange(next === 'true')} options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} value={String(value) as 'true' | 'false'} />;
}

function toApiPayload(kind: ExtendedMasterDataKind, item: Omit<SimpleMasterDataItem, 'id'>) {
  const common = { active: item.active, sortOrder: item.sortOrder };

  switch (kind) {
    case 'colors':
      return { ...common, name: item.name, slug: item.slug, hex: item.value === 'Sin HEX' ? null : item.value };
    case 'storageCapacities':
    case 'ramCapacities':
      return { ...common, label: item.name, valueGb: Number(item.value) };
    case 'conditions':
      return { ...common, name: item.name, slug: item.slug, description: item.description, grade: item.value };
    case 'sparePartTypes':
      return { ...common, parentId: item.parentId, name: item.name, slug: item.slug };
  }
}

function fromApiItem(kind: ExtendedMasterDataKind, item: any): SimpleMasterDataItem {
  switch (kind) {
    case 'colors':
      return { id: item.id, name: item.name, slug: item.slug, value: item.hex ?? 'Sin HEX', description: '', parentId: null, active: item.active, sortOrder: item.sortOrder };
    case 'storageCapacities':
    case 'ramCapacities':
      return { id: item.id, name: item.label, slug: '', value: String(item.valueGb), description: '', parentId: null, active: item.active, sortOrder: item.sortOrder };
    case 'conditions':
      return { id: item.id, name: item.name, slug: item.slug, value: item.grade, description: item.description ?? '', parentId: null, active: item.active, sortOrder: item.sortOrder };
    case 'sparePartTypes':
      return { id: item.id, name: item.name, slug: item.slug, value: item.slug, description: '', parentId: item.parentId ?? null, active: item.active, sortOrder: item.sortOrder };
  }
}

function SimpleMasterDataPage({ config, gateway, onChanged }: { config: SimpleMasterDataConfig; gateway: MasterDataGateway; onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<SimpleMasterDataItem[]>(() => [...config.initialItems]);
  const [form, setForm] = useState<SimpleFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const parentOptions = useMemo(() => [{ value: '', label: 'Sin padre' }, ...items.map((item) => ({ value: item.id, label: item.name }))], [items]);

  function newItem() {
    setError(null);
    setForm({ name: '', slug: '', value: '', description: '', parentId: null, active: true, sortOrder: (items.length + 1) * 10 });
  }

  function editItem(item: SimpleMasterDataItem) {
    setError(null);
    setForm({ ...item });
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const name = form.name.trim();
    const slug = normalizeSlug(form.slug || name);
    const value = form.value.trim();
    const parentId = form.parentId || null;

    if (!name) { setError('El nombre es obligatorio.'); return; }
    if (config.supportsSlug && !slug) { setError('El slug es obligatorio.'); return; }
    if (!value) { setError(`${config.valueLabel} es obligatorio.`); return; }
    if ((config.kind === 'storageCapacities' || config.kind === 'ramCapacities') && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
      setError('La capacidad debe ser un número entero mayor que cero.');
      return;
    }
    if (config.supportsParent && form.id && parentId === form.id) { setError('Un elemento no puede ser padre de sí mismo.'); return; }
    if (config.supportsSlug && items.some((item) => item.slug === slug && item.id !== form.id)) { setError('Ya existe un elemento con ese slug.'); return; }

    const simplePayload = { name, slug, value, description: form.description.trim(), parentId, active: form.active, sortOrder: form.sortOrder };

    try {
      const apiPayload = toApiPayload(config.kind, simplePayload);
      const savedRaw = form.id
        ? await gateway.update<any>(config.kind, form.id, apiPayload)
        : await gateway.create<any>(config.kind, apiPayload);
      const saved = fromApiItem(config.kind, savedRaw);
      setItems((current) => form.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setForm(null);
      setNotice({ tone: 'success', message: form.id ? `${config.singularLabel} actualizado.` : `${config.singularLabel} creado.` });
      await onChanged();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  }

  function requestToggle(item: SimpleMasterDataItem) {
    setConfirmAction({
      title: item.active ? `Desactivar ${config.singularLabel.toLocaleLowerCase()}` : `Activar ${config.singularLabel.toLocaleLowerCase()}`,
      message: `${item.active ? 'Desactivar' : 'Activar'} ${item.name} en el catálogo maestro.`,
      confirmLabel: item.active ? 'Desactivar' : 'Activar',
      tone: 'warning',
      onConfirm: async () => {
        try {
          const savedRaw = await gateway.update<any>(config.kind, item.id, { active: !item.active });
          const saved = fromApiItem(config.kind, savedRaw);
          setItems((current) => current.map((candidate) => candidate.id === item.id ? saved : candidate));
          setConfirmAction(null);
          setNotice({ tone: 'success', message: item.active ? `${config.singularLabel} desactivado.` : `${config.singularLabel} activado.` });
          await onChanged();
        } catch (toggleError) {
          setConfirmAction(null);
          setNotice({ tone: 'warning', message: errorMessage(toggleError) });
        }
      },
    });
  }

  function requestDelete(item: SimpleMasterDataItem) {
    setConfirmAction({
      title: `Eliminar ${config.singularLabel.toLocaleLowerCase()}`,
      message: `Eliminar ${item.name} de forma permanente.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await gateway.delete(config.kind, item.id);
          setItems((current) => current.filter((candidate) => candidate.id !== item.id));
          setConfirmAction(null);
          setNotice({ tone: 'warning', message: `${config.singularLabel} eliminado.` });
          await onChanged();
        } catch (deleteError) {
          setConfirmAction(null);
          setNotice({ tone: 'warning', message: errorMessage(deleteError) });
        }
      },
    });
  }

  const columns: readonly DataTableColumn<SimpleMasterDataItem>[] = [
    { id: 'name', header: 'Nombre', cell: (item) => <div><strong className="text-slate-900">{item.name}</strong><div className="text-xs text-slate-400">{item.id}</div></div>, sortable: true, sortValue: (item) => item.name, searchValue: (item) => textSearch([item.name, item.slug, item.id]) },
    ...(config.supportsParent ? [{ id: 'parent', header: config.parentLabel ?? 'Padre', cell: (item: SimpleMasterDataItem) => item.parentId ? itemsById.get(item.parentId)?.name ?? item.parentId : 'Raíz', sortable: true, sortValue: (item: SimpleMasterDataItem) => item.parentId ? itemsById.get(item.parentId)?.name ?? item.parentId : '', searchValue: (item: SimpleMasterDataItem) => item.parentId ? itemsById.get(item.parentId)?.name ?? item.parentId : '' }] satisfies readonly DataTableColumn<SimpleMasterDataItem>[] : []),
    { id: 'value', header: config.valueLabel, cell: (item) => <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.value}</code>, sortable: true, sortValue: (item) => item.value, searchValue: (item) => item.value },
    ...(config.supportsDescription ? [{ id: 'description', header: config.descriptionLabel ?? 'Descripción', cell: (item: SimpleMasterDataItem) => <span className="text-xs leading-5 text-slate-500">{item.description || 'Sin descripción'}</span>, searchValue: (item: SimpleMasterDataItem) => item.description }] satisfies readonly DataTableColumn<SimpleMasterDataItem>[] : []),
    ...(config.supportsSlug ? [{ id: 'slug', header: 'Slug', cell: (item: SimpleMasterDataItem) => <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.slug}</code>, sortable: true, sortValue: (item: SimpleMasterDataItem) => item.slug, searchValue: (item: SimpleMasterDataItem) => item.slug }] satisfies readonly DataTableColumn<SimpleMasterDataItem>[] : []),
    { id: 'status', header: 'Estado', cell: (item) => status(item.active), sortable: true, sortValue: (item) => Number(item.active), searchValue: (item) => (item.active ? 'activo' : 'inactivo') },
    { id: 'sortOrder', header: 'Orden', cell: (item) => item.sortOrder, align: 'right', sortable: true, sortValue: (item) => item.sortOrder, searchValue: (item) => String(item.sortOrder) },
    { id: 'actions', header: 'Acciones', cell: (item) => <div className="flex flex-wrap gap-1"><ActionButton onClick={() => editItem(item)}>Editar</ActionButton><ActionButton onClick={() => requestToggle(item)} tone="warning">{item.active ? 'Desactivar' : 'Activar'}</ActionButton><ActionButton onClick={() => requestDelete(item)} tone="danger">Eliminar</ActionButton></div> },
  ];

  return <PageShell actions={<button className="rounded-md bg-[var(--theme-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95" data-extended-master-data-create onClick={newItem} type="button">{config.createLabel}</button>} breadcrumbs={[{ label: 'Admin' }, { label: 'Datos Maestros' }, { label: config.title }]} description={config.description} title={config.title}>
    <div className="grid gap-3" data-extended-master-data={config.kind} data-testid={config.dataAttribute}>
      <PersistenceNote /><AdminNotice notice={notice} />
      <DataTable caption={config.title} columns={columns} emptyMessage="No hay datos para mostrar." getRowId={(item) => item.id} initialPageSize={5} pageSizeOptions={[5, 10, 25]} rows={items} searchable searchLabel={`Buscar ${config.title.toLocaleLowerCase()}`} searchPlaceholder="Buscar por nombre, slug, valor o estado…" />
      {form ? <FormModal error={error} onCancel={() => setForm(null)} onSubmit={(event) => void saveItem(event)} submitLabel={form.id ? 'Guardar' : 'Crear'} title={form.id ? `Editar ${config.singularLabel.toLocaleLowerCase()}` : config.createLabel}>
        {config.supportsParent ? <SelectField id={`${config.kind}-parent`} label={config.parentLabel ?? 'Padre'} onChange={(value) => setForm((current) => current ? { ...current, parentId: value || null } : current)} options={parentOptions.filter((option) => option.value !== form.id)} value={form.parentId ?? ''} /> : null}
        <TextField id={`${config.kind}-name`} label="Nombre" onChange={(value) => setForm((current) => current ? { ...current, name: value, slug: current.slug || normalizeSlug(value) } : current)} value={form.name} />
        <TextField id={`${config.kind}-value`} label={config.valueLabel} onChange={(value) => setForm((current) => current ? { ...current, value } : current)} placeholder={config.valuePlaceholder} value={form.value} />
        {config.supportsSlug ? <TextField id={`${config.kind}-slug`} label="Slug" onChange={(value) => setForm((current) => current ? { ...current, slug: value } : current)} value={form.slug} /> : null}
        {config.supportsDescription ? <div className="md:col-span-2"><TextAreaField id={`${config.kind}-description`} label={config.descriptionLabel ?? 'Descripción'} onChange={(value) => setForm((current) => current ? { ...current, description: value } : current)} value={form.description} /></div> : null}
        <TextField id={`${config.kind}-sort-order`} label="Orden" onChange={(value) => setForm((current) => current ? { ...current, sortOrder: toSortOrder(value) } : current)} value={String(form.sortOrder)} />
        <BooleanSelect id={`${config.kind}-active`} label="Estado" onChange={(value) => setForm((current) => current ? { ...current, active: value } : current)} value={form.active} />
      </FormModal> : null}
      <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} />
    </div>
  </PageShell>;
}

export function MasterDataColorsPage({ masterDataProvider, gateway, onChanged }: ExtendedPageProps) {
  return <SimpleMasterDataPage gateway={gateway} onChanged={onChanged} config={{
    kind: 'colors',
    title: 'Colores',
    description: 'Catálogo canónico de colores para equipos, variantes y filtros comerciales.',
    createLabel: 'Nuevo color',
    singularLabel: 'Color',
    dataAttribute: 'master-data-colors',
    valueLabel: 'HEX',
    valuePlaceholder: '#111827',
    supportsSlug: true,
    initialItems: masterDataProvider.getColors().map((color) => ({ id: color.id, name: color.name, slug: color.slug, value: color.hex ?? 'Sin HEX', description: '', parentId: null, active: color.active, sortOrder: color.sortOrder })),
  }} />;
}

export function MasterDataStorageCapacitiesPage({ masterDataProvider, gateway, onChanged }: ExtendedPageProps) {
  return <SimpleMasterDataPage gateway={gateway} onChanged={onChanged} config={{
    kind: 'storageCapacities',
    title: 'Almacenamientos',
    description: 'Capacidades de almacenamiento normalizadas para dispositivos y variantes.',
    createLabel: 'Nuevo almacenamiento',
    singularLabel: 'Almacenamiento',
    dataAttribute: 'master-data-storage',
    valueLabel: 'GB',
    valuePlaceholder: '128',
    initialItems: masterDataProvider.getStorageCapacities().map((storage) => ({ id: storage.id, name: storage.label, slug: '', value: String(storage.valueGb), description: '', parentId: null, active: storage.active, sortOrder: storage.sortOrder })),
  }} />;
}

export function MasterDataRamCapacitiesPage({ masterDataProvider, gateway, onChanged }: ExtendedPageProps) {
  return <SimpleMasterDataPage gateway={gateway} onChanged={onChanged} config={{
    kind: 'ramCapacities',
    title: 'RAM',
    description: 'Capacidades de memoria RAM normalizadas para dispositivos y filtros.',
    createLabel: 'Nueva RAM',
    singularLabel: 'RAM',
    dataAttribute: 'master-data-ram',
    valueLabel: 'GB',
    valuePlaceholder: '8',
    initialItems: masterDataProvider.getRamCapacities().map((ram) => ({ id: ram.id, name: ram.label, slug: '', value: String(ram.valueGb), description: '', parentId: null, active: ram.active, sortOrder: ram.sortOrder })),
  }} />;
}

export function MasterDataConditionsPage({ masterDataProvider, gateway, onChanged }: ExtendedPageProps) {
  return <SimpleMasterDataPage gateway={gateway} onChanged={onChanged} config={{
    kind: 'conditions',
    title: 'Condiciones',
    description: 'Estados comerciales y operativos normalizados para inventario y catálogo.',
    createLabel: 'Nueva condición',
    singularLabel: 'Condición',
    dataAttribute: 'master-data-conditions',
    valueLabel: 'Grado',
    valuePlaceholder: 'A',
    descriptionLabel: 'Descripción',
    supportsSlug: true,
    supportsDescription: true,
    initialItems: masterDataProvider.getConditions().map((condition) => ({ id: condition.id, name: condition.name, slug: condition.slug, value: condition.grade, description: condition.description, parentId: null, active: condition.active, sortOrder: condition.sortOrder })),
  }} />;
}

export function MasterDataSparePartTypesPage({ masterDataProvider, gateway, onChanged }: ExtendedPageProps) {
  return <SimpleMasterDataPage gateway={gateway} onChanged={onChanged} config={{
    kind: 'sparePartTypes',
    title: 'Tipos de repuesto',
    description: 'Tipos de pieza normalizados para repuestos, compatibilidad e inventario.',
    createLabel: 'Nuevo tipo',
    singularLabel: 'Tipo de repuesto',
    dataAttribute: 'master-data-spare-part-types',
    valueLabel: 'Clave',
    valuePlaceholder: 'display-oled',
    supportsSlug: true,
    supportsParent: true,
    parentLabel: 'Tipo padre',
    initialItems: masterDataProvider.getSparePartTypes().map((type) => ({ id: type.id, name: type.name, slug: type.slug, value: type.slug, description: '', parentId: type.parentId, active: type.active, sortOrder: type.sortOrder })),
  }} />;
}
