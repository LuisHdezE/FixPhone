import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField, type SelectFieldOption } from '@/components/forms/SelectField';
import { mockInventoryRepository } from './mockInventoryRepository';
import type { InventoryDataState, InventoryFilter, InventoryHealth, InventoryHealthFilter, InventoryItem, InventoryRepository } from './inventory.types';
const labels: Record<InventoryHealth, string> = { healthy: 'Saludable', reorder: 'Reponer pronto', 'out-of-stock': 'Agotado' };
const tones: Record<InventoryHealth, StatusBadgeTone> = { healthy: 'success', reorder: 'warning', 'out-of-stock': 'neutral' };
const options: readonly SelectFieldOption<InventoryHealthFilter>[] = [{ value: 'all', label: 'Todos' }, { value: 'healthy', label: 'Saludable' }, { value: 'reorder', label: 'Reponer pronto' }, { value: 'out-of-stock', label: 'Agotado' }];
const columns: readonly DataTableColumn<InventoryItem>[] = [
  { id: 'product', header: 'Producto', className: 'min-w-64', cell: (item) => <div><p className="font-semibold text-slate-900">{item.productName}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{item.sku}</p></div> },
  { id: 'category', header: 'Categoría', cell: (item) => item.category },
  { id: 'stock', header: 'Existencias', cell: (item) => <div><p className="font-semibold text-slate-900">{item.stockQuantity} unidades</p><p className="mt-1 text-[11px] text-slate-400">Mínimo {item.reorderPoint}</p></div> },
  { id: 'health', header: 'Salud', cell: (item) => <StatusBadge label={labels[item.health]} tone={tones[item.health]} /> },
  { id: 'updated', header: 'Actualizado', align: 'right', cell: (item) => <span className="text-xs text-slate-500">{item.updatedAtLabel}</span> },
];
const initialFilter: InventoryFilter = { search: '', health: 'all' };
export function InventoryView({ repository = mockInventoryRepository }: { repository?: InventoryRepository }) {
  const [filter, setFilter] = useState(initialFilter); const [state, setState] = useState<InventoryDataState>({ status: 'loading' });
  useEffect(() => { let active = true; repository.list(filter).then((next) => { if (active) setState(next); }).catch(() => { if (active) setState({ status: 'error', message: 'No fue posible cargar el estado del inventario.' }); }); return () => { active = false; }; }, [filter, repository]);
  const hasFilters = filter.search.trim().length > 0 || filter.health !== 'all';
  return <div className="grid gap-4"><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-brand-600">Control de existencias</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Inventario operativo</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Identifica artículos saludables, reposiciones próximas y quiebres de stock en una sola vista.</p></div>{state.status === 'success' ? <p className="text-xs font-semibold text-slate-500">{state.total} artículos mostrados</p> : null}</div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"><SearchField id="inventory-search" label="Buscar inventario" onChange={(search) => setFilter((current) => ({ ...current, search }))} placeholder="Producto, SKU o categoría" value={filter.search} /><SelectField id="inventory-health-filter" label="Salud del inventario" onChange={(health) => setFilter((current) => ({ ...current, health }))} options={options} value={filter.health} /><button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={!hasFilters} onClick={() => setFilter(initialFilter)} type="button">Limpiar filtros</button></div></section>{state.status === 'loading' || state.status === 'idle' ? <InlineFeedback title="Cargando inventario" message="Estamos preparando el estado de existencias." tone="info" /> : null}{state.status === 'error' ? <InlineFeedback title="No se pudo cargar el inventario" message={state.message} tone="error" /> : null}{state.status === 'empty' ? <InlineFeedback title="Sin coincidencias" message={state.message} /> : null}{state.status === 'success' ? <DataTable caption="Inventario operativo" columns={columns} getRowId={(item) => item.id} rows={state.items} /> : null}</div>;
}
