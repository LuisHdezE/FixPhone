import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { TextField } from '@/components/forms/TextField';
import { PageShell } from '@/shell/PageShell';
import type { MasterDataAdminViewProvider, MasterDataProvider } from '../application/master-data.contracts';
import type { MasterDataBrandDto, MasterDataCategoryDto, MasterDataDeviceModelDto } from '../application/master-data.dto';

interface MasterDataAdminPageProps {
  masterDataProvider: MasterDataProvider;
  viewProvider: MasterDataAdminViewProvider;
}

type BrandFormState = Omit<MasterDataBrandDto, 'id'> & { id?: string };
type DeviceModelFormState = Omit<MasterDataDeviceModelDto, 'id'> & { id?: string };
type CategoryFormState = Omit<MasterDataCategoryDto, 'id'> & { id?: string };
type Notice = { tone: 'success' | 'warning'; message: string } | null;
type ConfirmAction = { title: string; message: string; confirmLabel: string; tone: 'warning' | 'danger'; onConfirm: () => void } | null;

const status = (active: boolean) => <StatusBadge label={active ? 'Activo' : 'Inactivo'} tone={active ? 'success' : 'neutral'} />;
const yesNo = (enabled: boolean) => <StatusBadge label={enabled ? 'Visible' : 'Oculto'} tone={enabled ? 'info' : 'neutral'} />;

function breadcrumbItems(labels: readonly string[]) { return labels.map((label) => ({ label })); }
function textSearch(values: readonly (string | number | null | undefined)[]) { return values.filter((value) => value !== null && value !== undefined).join(' '); }
function normalizeSlug(value: string) { return value.trim().toLocaleLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'); }
function nextId(prefix: string, existingIds: readonly string[]) {
  let index = existingIds.length + 1;
  let candidate = `${prefix}-${index}`;
  while (existingIds.includes(candidate)) { index += 1; candidate = `${prefix}-${index}`; }
  return candidate;
}
function toSortOrder(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

function AdminNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <div className={`rounded-md border px-3 py-2 text-xs ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`} role="status">{notice.message}</div>;
}

function LocalPersistenceNote() {
  return <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-500">Modo local temporal. Los cambios se mantienen durante esta sesión y se reinician al recargar. El guardado permanente se habilitará al conectar el servicio de datos.</p>;
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
    <form className="p-4" data-master-data-form onSubmit={onSubmit}>
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
        <button className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition ${buttonClass}`} onClick={action.onConfirm} type="button">{action.confirmLabel}</button>
      </div>
    </div>
  </ModalShell>;
}

function BooleanSelect({ id, label, value, onChange, trueLabel = 'Sí', falseLabel = 'No' }: { id: string; label: string; value: boolean; onChange: (value: boolean) => void; trueLabel?: string; falseLabel?: string }) {
  return <SelectField id={id} label={label} onChange={(next) => onChange(next === 'true')} options={[{ value: 'true', label: trueLabel }, { value: 'false', label: falseLabel }]} value={String(value) as 'true' | 'false'} />;
}

function ActionButton({ children, onClick, tone = 'neutral' }: { children: ReactNode; onClick: () => void; tone?: 'neutral' | 'warning' | 'danger' }) {
  const classes = tone === 'danger' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : tone === 'warning' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50';
  return <button className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${classes}`} onClick={onClick} type="button">{children}</button>;
}

const PrimaryAction = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button className="rounded-md bg-[var(--theme-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95" data-master-data-create onClick={onClick} type="button">{children}</button>;

export function MasterDataBrandsPage({ masterDataProvider, viewProvider }: MasterDataAdminPageProps) {
  const view = viewProvider.getView('brands');
  const [brands, setBrands] = useState<MasterDataBrandDto[]>(() => [...masterDataProvider.getBrands()]);
  const [models] = useState<readonly MasterDataDeviceModelDto[]>(() => masterDataProvider.getDeviceModels());
  const [form, setForm] = useState<BrandFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const modelCountByBrand = useMemo(() => { const counts = new Map<string, number>(); for (const model of models) counts.set(model.brandId, (counts.get(model.brandId) ?? 0) + 1); return counts; }, [models]);

  function newBrand() { setError(null); setForm({ name: '', slug: '', logo: null, active: true, sortOrder: (brands.length + 1) * 10 }); }
  function editBrand(brand: MasterDataBrandDto) { setError(null); setForm({ ...brand }); }
  function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form) return;
    const name = form.name.trim(); const slug = normalizeSlug(form.slug || name);
    if (!name || !slug) { setError('Nombre y slug son obligatorios.'); return; }
    if (brands.some((brand) => brand.slug === slug && brand.id !== form.id)) { setError('Ya existe una marca con ese slug.'); return; }
    const id = form.id ?? nextId('brand-local', brands.map((brand) => brand.id));
    const saved: MasterDataBrandDto = { id, name, slug, logo: form.logo?.trim() || null, active: form.active, sortOrder: form.sortOrder };
    setBrands((current) => form.id ? current.map((brand) => brand.id === id ? saved : brand) : [...current, saved]);
    setForm(null); setNotice({ tone: 'success', message: form.id ? 'Marca actualizada localmente.' : 'Marca creada localmente.' });
  }
  function requestToggleBrand(brand: MasterDataBrandDto) { setConfirmAction({ title: brand.active ? 'Desactivar marca' : 'Activar marca', message: `${brand.active ? 'Desactivar' : 'Activar'} ${brand.name} solo afectará esta sesión local.`, confirmLabel: brand.active ? 'Desactivar' : 'Activar', tone: 'warning', onConfirm: () => { setBrands((current) => current.map((item) => item.id === brand.id ? { ...item, active: !item.active } : item)); setConfirmAction(null); setNotice({ tone: 'warning', message: brand.active ? 'Marca desactivada localmente.' : 'Marca activada localmente.' }); } }); }
  function requestDeleteBrand(brand: MasterDataBrandDto) { setConfirmAction({ title: 'Eliminar marca', message: `Eliminar ${brand.name} de esta sesión no afectará datos reales.`, confirmLabel: 'Eliminar', tone: 'danger', onConfirm: () => { setBrands((current) => current.filter((item) => item.id !== brand.id)); setConfirmAction(null); setNotice({ tone: 'warning', message: 'Marca eliminada localmente.' }); } }); }

  const columns: readonly DataTableColumn<MasterDataBrandDto>[] = [
    { id: 'name', header: view.columns.find((column) => column.id === 'name')?.header ?? 'Marca', cell: (brand) => <div><strong className="text-slate-900">{brand.name}</strong><div className="text-xs text-slate-400">{brand.id}</div></div>, sortable: true, sortValue: (brand) => brand.name, searchValue: (brand) => textSearch([brand.name, brand.slug, brand.id]) },
    { id: 'slug', header: view.columns.find((column) => column.id === 'slug')?.header ?? 'Slug', cell: (brand) => <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{brand.slug}</code>, sortable: true, sortValue: (brand) => brand.slug, searchValue: (brand) => brand.slug },
    { id: 'models', header: view.columns.find((column) => column.id === 'models')?.header ?? 'Modelos', cell: (brand) => `${modelCountByBrand.get(brand.id) ?? 0} modelos`, align: 'right', sortable: true, sortValue: (brand) => modelCountByBrand.get(brand.id) ?? 0, searchValue: (brand) => String(modelCountByBrand.get(brand.id) ?? 0) },
    { id: 'status', header: view.columns.find((column) => column.id === 'status')?.header ?? 'Estado', cell: (brand) => status(brand.active), sortable: true, sortValue: (brand) => Number(brand.active), searchValue: (brand) => (brand.active ? 'activo' : 'inactivo') },
    { id: 'sortOrder', header: view.columns.find((column) => column.id === 'sortOrder')?.header ?? 'Orden', cell: (brand) => brand.sortOrder, align: 'right', sortable: true, sortValue: (brand) => brand.sortOrder, searchValue: (brand) => String(brand.sortOrder) },
    { id: 'actions', header: 'Acciones', cell: (brand) => <div className="flex flex-wrap gap-1"><ActionButton onClick={() => editBrand(brand)}>Editar</ActionButton><ActionButton onClick={() => requestToggleBrand(brand)} tone="warning">{brand.active ? 'Desactivar' : 'Activar'}</ActionButton><ActionButton onClick={() => requestDeleteBrand(brand)} tone="danger">Eliminar</ActionButton></div> },
  ];

  return <PageShell actions={<PrimaryAction onClick={newBrand}>Nueva marca</PrimaryAction>} breadcrumbs={breadcrumbItems(view.breadcrumbs)} description={view.description} title={view.title}>
    <div className="grid gap-3" data-master-data-brands>
      <LocalPersistenceNote /><AdminNotice notice={notice} />
      <DataTable caption={view.title} columns={columns} emptyMessage={view.emptyMessage} getRowId={(brand) => brand.id} initialPageSize={5} pageSizeOptions={[5, 10, 25]} rows={brands} searchable searchLabel={view.searchLabel} searchPlaceholder={view.searchPlaceholder} />
      {form ? <FormModal error={error} onCancel={() => setForm(null)} onSubmit={saveBrand} submitLabel={form.id ? 'Guardar' : 'Crear'} title={form.id ? 'Editar marca' : 'Nueva marca'}>
        <TextField id="brand-name" label="Nombre" onChange={(value) => setForm((current) => current ? { ...current, name: value, slug: current.slug || normalizeSlug(value) } : current)} value={form.name} />
        <TextField id="brand-slug" label="Slug" onChange={(value) => setForm((current) => current ? { ...current, slug: value } : current)} value={form.slug} />
        <TextField id="brand-logo" label="Logo opcional" onChange={(value) => setForm((current) => current ? { ...current, logo: value } : current)} value={form.logo ?? ''} />
        <TextField id="brand-sort-order" label="Orden" onChange={(value) => setForm((current) => current ? { ...current, sortOrder: toSortOrder(value) } : current)} value={String(form.sortOrder)} />
        <BooleanSelect id="brand-active" label="Estado" onChange={(value) => setForm((current) => current ? { ...current, active: value } : current)} value={form.active} trueLabel="Activa" falseLabel="Inactiva" />
      </FormModal> : null}
      <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} />
    </div>
  </PageShell>;
}

export function MasterDataDeviceModelsPage({ masterDataProvider, viewProvider }: MasterDataAdminPageProps) {
  const view = viewProvider.getView('deviceModels');
  const [brands] = useState<readonly MasterDataBrandDto[]>(() => masterDataProvider.getBrands());
  const [models, setModels] = useState<MasterDataDeviceModelDto[]>(() => [...masterDataProvider.getDeviceModels()]);
  const [form, setForm] = useState<DeviceModelFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const brandsById = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);

  function newModel() { setError(null); setForm({ brandId: brands[0]?.id ?? '', name: '', slug: '', modelCode: null, active: true, sortOrder: (models.length + 1) * 10 }); }
  function editModel(model: MasterDataDeviceModelDto) { setError(null); setForm({ ...model }); }
  function saveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form) return;
    const name = form.name.trim(); const slug = normalizeSlug(form.slug || name);
    if (!name || !slug) { setError('Nombre y slug son obligatorios.'); return; }
    if (!form.brandId) { setError('El modelo debe tener una marca.'); return; }
    if (models.some((model) => model.slug === slug && model.id !== form.id)) { setError('Ya existe un modelo con ese slug.'); return; }
    const id = form.id ?? nextId('model-local', models.map((model) => model.id));
    const saved: MasterDataDeviceModelDto = { id, brandId: form.brandId, name, slug, modelCode: form.modelCode?.trim() || null, active: form.active, sortOrder: form.sortOrder };
    setModels((current) => form.id ? current.map((model) => model.id === id ? saved : model) : [...current, saved]);
    setForm(null); setNotice({ tone: 'success', message: form.id ? 'Modelo actualizado localmente.' : 'Modelo creado localmente.' });
  }
  function requestToggleModel(model: MasterDataDeviceModelDto) { setConfirmAction({ title: model.active ? 'Desactivar modelo' : 'Activar modelo', message: `${model.active ? 'Desactivar' : 'Activar'} ${model.name} solo afectará esta sesión local.`, confirmLabel: model.active ? 'Desactivar' : 'Activar', tone: 'warning', onConfirm: () => { setModels((current) => current.map((item) => item.id === model.id ? { ...item, active: !item.active } : item)); setConfirmAction(null); setNotice({ tone: 'warning', message: model.active ? 'Modelo desactivado localmente.' : 'Modelo activado localmente.' }); } }); }
  function requestDeleteModel(model: MasterDataDeviceModelDto) { setConfirmAction({ title: 'Eliminar modelo', message: `Eliminar ${model.name} de esta sesión no afectará datos reales.`, confirmLabel: 'Eliminar', tone: 'danger', onConfirm: () => { setModels((current) => current.filter((item) => item.id !== model.id)); setConfirmAction(null); setNotice({ tone: 'warning', message: 'Modelo eliminado localmente.' }); } }); }

  const columns: readonly DataTableColumn<MasterDataDeviceModelDto>[] = [
    { id: 'name', header: view.columns.find((column) => column.id === 'name')?.header ?? 'Modelo', cell: (model) => <div><strong className="text-slate-900">{model.name}</strong><div className="text-xs text-slate-400">{model.id}</div></div>, sortable: true, sortValue: (model) => model.name, searchValue: (model) => textSearch([model.name, model.slug, model.id]) },
    { id: 'brand', header: view.columns.find((column) => column.id === 'brand')?.header ?? 'Marca', cell: (model) => brandsById.get(model.brandId)?.name ?? model.brandId, sortable: true, sortValue: (model) => brandsById.get(model.brandId)?.name ?? model.brandId, searchValue: (model) => brandsById.get(model.brandId)?.name ?? model.brandId },
    { id: 'code', header: view.columns.find((column) => column.id === 'code')?.header ?? 'Código', cell: (model) => model.modelCode ?? 'Sin código', sortable: true, sortValue: (model) => model.modelCode ?? '', searchValue: (model) => model.modelCode ?? '' },
    { id: 'slug', header: view.columns.find((column) => column.id === 'slug')?.header ?? 'Slug', cell: (model) => <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{model.slug}</code>, sortable: true, sortValue: (model) => model.slug, searchValue: (model) => model.slug },
    { id: 'status', header: view.columns.find((column) => column.id === 'status')?.header ?? 'Estado', cell: (model) => status(model.active), sortable: true, sortValue: (model) => Number(model.active), searchValue: (model) => (model.active ? 'activo' : 'inactivo') },
    { id: 'sortOrder', header: view.columns.find((column) => column.id === 'sortOrder')?.header ?? 'Orden', cell: (model) => model.sortOrder, align: 'right', sortable: true, sortValue: (model) => model.sortOrder, searchValue: (model) => String(model.sortOrder) },
    { id: 'actions', header: 'Acciones', cell: (model) => <div className="flex flex-wrap gap-1"><ActionButton onClick={() => editModel(model)}>Editar</ActionButton><ActionButton onClick={() => requestToggleModel(model)} tone="warning">{model.active ? 'Desactivar' : 'Activar'}</ActionButton><ActionButton onClick={() => requestDeleteModel(model)} tone="danger">Eliminar</ActionButton></div> },
  ];

  return <PageShell actions={<PrimaryAction onClick={newModel}>Nuevo modelo</PrimaryAction>} breadcrumbs={breadcrumbItems(view.breadcrumbs)} description={view.description} title={view.title}>
    <div className="grid gap-3" data-master-data-device-models>
      <LocalPersistenceNote /><AdminNotice notice={notice} />
      <DataTable caption={view.title} columns={columns} emptyMessage={view.emptyMessage} getRowId={(model) => model.id} initialPageSize={5} pageSizeOptions={[5, 10, 25]} rows={models} searchable searchLabel={view.searchLabel} searchPlaceholder={view.searchPlaceholder} />
      {form ? <FormModal error={error} onCancel={() => setForm(null)} onSubmit={saveModel} submitLabel={form.id ? 'Guardar' : 'Crear'} title={form.id ? 'Editar modelo' : 'Nuevo modelo'}>
        <SelectField id="model-brand" label="Marca" onChange={(value) => setForm((current) => current ? { ...current, brandId: value } : current)} options={brands.map((brand) => ({ value: brand.id, label: brand.name }))} value={form.brandId} />
        <TextField id="model-name" label="Nombre" onChange={(value) => setForm((current) => current ? { ...current, name: value, slug: current.slug || normalizeSlug(value) } : current)} value={form.name} />
        <TextField id="model-slug" label="Slug" onChange={(value) => setForm((current) => current ? { ...current, slug: value } : current)} value={form.slug} />
        <TextField id="model-code" label="Código" onChange={(value) => setForm((current) => current ? { ...current, modelCode: value } : current)} value={form.modelCode ?? ''} />
        <TextField id="model-sort-order" label="Orden" onChange={(value) => setForm((current) => current ? { ...current, sortOrder: toSortOrder(value) } : current)} value={String(form.sortOrder)} />
        <BooleanSelect id="model-active" label="Estado" onChange={(value) => setForm((current) => current ? { ...current, active: value } : current)} value={form.active} trueLabel="Activo" falseLabel="Inactivo" />
      </FormModal> : null}
      <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} />
    </div>
  </PageShell>;
}

export function MasterDataCategoriesPage({ masterDataProvider, viewProvider }: MasterDataAdminPageProps) {
  const view = viewProvider.getView('categories');
  const [categories, setCategories] = useState<MasterDataCategoryDto[]>(() => [...masterDataProvider.getCategories()]);
  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  function newCategory() { setError(null); setForm({ parentId: null, name: '', slug: '', description: '', imageOrIcon: null, active: true, showInStorefront: true, sortOrder: (categories.length + 1) * 10 }); }
  function editCategory(category: MasterDataCategoryDto) { setError(null); setForm({ ...category }); }
  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form) return;
    const name = form.name.trim(); const slug = normalizeSlug(form.slug || name); const parentId = form.parentId || null;
    if (!name || !slug) { setError('Nombre y slug son obligatorios.'); return; }
    if (form.id && parentId === form.id) { setError('Una categoría no puede ser padre de sí misma.'); return; }
    if (categories.some((category) => category.slug === slug && category.id !== form.id)) { setError('Ya existe una categoría con ese slug.'); return; }
    const id = form.id ?? nextId('cat-local', categories.map((category) => category.id));
    const saved: MasterDataCategoryDto = { id, parentId, name, slug, description: form.description.trim(), imageOrIcon: form.imageOrIcon?.trim() || null, active: form.active, showInStorefront: form.showInStorefront, sortOrder: form.sortOrder };
    setCategories((current) => form.id ? current.map((category) => category.id === id ? saved : category) : [...current, saved]);
    setForm(null); setNotice({ tone: 'success', message: form.id ? 'Categoría actualizada localmente.' : 'Categoría creada localmente.' });
  }
  function requestToggleCategory(category: MasterDataCategoryDto) { setConfirmAction({ title: category.active ? 'Desactivar categoría' : 'Activar categoría', message: `${category.active ? 'Desactivar' : 'Activar'} ${category.name} solo afectará esta sesión local.`, confirmLabel: category.active ? 'Desactivar' : 'Activar', tone: 'warning', onConfirm: () => { setCategories((current) => current.map((item) => item.id === category.id ? { ...item, active: !item.active } : item)); setConfirmAction(null); setNotice({ tone: 'warning', message: category.active ? 'Categoría desactivada localmente.' : 'Categoría activada localmente.' }); } }); }
  function requestDeleteCategory(category: MasterDataCategoryDto) { setConfirmAction({ title: 'Eliminar categoría', message: `Eliminar ${category.name} dejará sus hijas como raíz dentro de esta sesión local.`, confirmLabel: 'Eliminar', tone: 'danger', onConfirm: () => { setCategories((current) => current.filter((item) => item.id !== category.id).map((item) => item.parentId === category.id ? { ...item, parentId: null } : item)); setConfirmAction(null); setNotice({ tone: 'warning', message: 'Categoría eliminada localmente. Sus hijas quedaron como raíz durante esta sesión.' }); } }); }

  const columns: readonly DataTableColumn<MasterDataCategoryDto>[] = [
    { id: 'name', header: view.columns.find((column) => column.id === 'name')?.header ?? 'Categoría', cell: (category) => <div><strong className="text-slate-900">{category.name}</strong><div className="max-w-md text-xs text-slate-400">{category.description}</div></div>, sortable: true, sortValue: (category) => category.name, searchValue: (category) => textSearch([category.name, category.slug, category.description, category.id]) },
    { id: 'parent', header: view.columns.find((column) => column.id === 'parent')?.header ?? 'Padre', cell: (category) => category.parentId ? categoriesById.get(category.parentId)?.name ?? category.parentId : 'Raíz', sortable: true, sortValue: (category) => category.parentId ? categoriesById.get(category.parentId)?.name ?? category.parentId : 'Raíz', searchValue: (category) => category.parentId ? categoriesById.get(category.parentId)?.name ?? category.parentId : 'Raíz' },
    { id: 'storefront', header: view.columns.find((column) => column.id === 'storefront')?.header ?? 'Storefront', cell: (category) => yesNo(category.showInStorefront), sortable: true, sortValue: (category) => Number(category.showInStorefront), searchValue: (category) => (category.showInStorefront ? 'visible' : 'oculto') },
    { id: 'status', header: view.columns.find((column) => column.id === 'status')?.header ?? 'Estado', cell: (category) => status(category.active), sortable: true, sortValue: (category) => Number(category.active), searchValue: (category) => (category.active ? 'activo' : 'inactivo') },
    { id: 'sortOrder', header: view.columns.find((column) => column.id === 'sortOrder')?.header ?? 'Orden', cell: (category) => category.sortOrder, align: 'right', sortable: true, sortValue: (category) => category.sortOrder, searchValue: (category) => String(category.sortOrder) },
    { id: 'actions', header: 'Acciones', cell: (category) => <div className="flex flex-wrap gap-1"><ActionButton onClick={() => editCategory(category)}>Editar</ActionButton><ActionButton onClick={() => requestToggleCategory(category)} tone="warning">{category.active ? 'Desactivar' : 'Activar'}</ActionButton><ActionButton onClick={() => requestDeleteCategory(category)} tone="danger">Eliminar</ActionButton></div> },
  ];

  return <PageShell actions={<PrimaryAction onClick={newCategory}>Nueva categoría</PrimaryAction>} breadcrumbs={breadcrumbItems(view.breadcrumbs)} description={view.description} title={view.title}>
    <div className="grid gap-3" data-master-data-categories>
      <LocalPersistenceNote /><AdminNotice notice={notice} />
      <DataTable caption={view.title} columns={columns} emptyMessage={view.emptyMessage} getRowId={(category) => category.id} initialPageSize={5} pageSizeOptions={[5, 10, 25]} rows={categories} searchable searchLabel={view.searchLabel} searchPlaceholder={view.searchPlaceholder} />
      {form ? <FormModal error={error} onCancel={() => setForm(null)} onSubmit={saveCategory} submitLabel={form.id ? 'Guardar' : 'Crear'} title={form.id ? 'Editar categoría' : 'Nueva categoría'}>
        <SelectField id="category-parent" label="Padre" onChange={(value) => setForm((current) => current ? { ...current, parentId: value || null } : current)} options={[{ value: '', label: 'Raíz' }, ...categories.filter((category) => category.id !== form.id).map((category) => ({ value: category.id, label: category.name }))]} value={form.parentId ?? ''} />
        <TextField id="category-name" label="Nombre" onChange={(value) => setForm((current) => current ? { ...current, name: value, slug: current.slug || normalizeSlug(value) } : current)} value={form.name} />
        <TextField id="category-slug" label="Slug" onChange={(value) => setForm((current) => current ? { ...current, slug: value } : current)} value={form.slug} />
        <TextField id="category-icon" label="Icono opcional" onChange={(value) => setForm((current) => current ? { ...current, imageOrIcon: value } : current)} value={form.imageOrIcon ?? ''} />
        <TextField id="category-sort-order" label="Orden" onChange={(value) => setForm((current) => current ? { ...current, sortOrder: toSortOrder(value) } : current)} value={String(form.sortOrder)} />
        <BooleanSelect id="category-active" label="Estado" onChange={(value) => setForm((current) => current ? { ...current, active: value } : current)} value={form.active} trueLabel="Activa" falseLabel="Inactiva" />
        <BooleanSelect id="category-storefront" label="Tienda" onChange={(value) => setForm((current) => current ? { ...current, showInStorefront: value } : current)} value={form.showInStorefront} trueLabel="Visible" falseLabel="Oculta" />
        <div className="md:col-span-2"><TextAreaField id="category-description" label="Descripción" onChange={(value) => setForm((current) => current ? { ...current, description: value } : current)} rows={3} value={form.description} /></div>
      </FormModal> : null}
      <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} />
    </div>
  </PageShell>;
}
