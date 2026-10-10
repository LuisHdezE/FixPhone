import { useMemo, useState, type ReactNode } from 'react';
import { SearchField } from '@/components/forms/SearchField';
import { SelectField } from '@/components/forms/SelectField';

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number;
  searchValue?: (row: Row) => string;
};

export type DataTableFilter<Row> = {
  id: string;
  label: string;
  allLabel?: string;
  options: readonly { value: string; label: string }[];
  value: (row: Row) => string;
};

export type DataTableProps<Row> = {
  rows: readonly Row[];
  columns: readonly DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  emptyMessage?: string;
  caption?: string;
  searchable?: boolean;
  searchLabel?: string;
  searchPlaceholder?: string;
  filters?: readonly DataTableFilter<Row>[];
  selectable?: boolean;
  pageSizeOptions?: readonly number[];
  initialPageSize?: number;
};

export function DataTable<Row>({
  rows,
  columns,
  getRowId,
  emptyMessage = 'No hay registros para mostrar.',
  caption,
  searchable = false,
  searchLabel = 'Buscar',
  searchPlaceholder = 'Buscar...',
  filters = [],
  selectable = false,
  pageSizeOptions = [10, 25, 50],
  initialPageSize,
}: DataTableProps<Row>) {
  const firstPageSize = initialPageSize ?? pageSizeOptions[0] ?? 10;
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pageSize, setPageSize] = useState(firstPageSize);
  const [page, setPage] = useState(1);

  const processedRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = rows.filter((row) => {
      if (normalizedQuery) {
        const searchableText = columns
          .map((column) => column.searchValue?.(row) ?? '')
          .join(' ')
          .toLocaleLowerCase();
        if (!searchableText.includes(normalizedQuery)) return false;
      }
      return filters.every((filter) => {
        const active = filterValues[filter.id] ?? '';
        return !active || filter.value(row) === active;
      });
    });

    if (!sort) return filtered;
    const column = columns.find((candidate) => candidate.id === sort.id);
    if (!column?.sortValue) return filtered;
    return [...filtered].sort((left, right) => {
      const a = column.sortValue?.(left) ?? '';
      const b = column.sortValue?.(right) ?? '';
      const comparison = typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [columns, filterValues, filters, query, rows, sort]);

  const pageCount = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = processedRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleIds = pageRows.map(getRowId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function resetPage() { setPage(1); }
  function toggleSort(column: DataTableColumn<Row>) {
    if (!column.sortable || !column.sortValue) return;
    setSort((current) => current?.id === column.id
      ? { id: column.id, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { id: column.id, direction: 'asc' });
    resetPage();
  }
  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function resetControls() {
    setQuery('');
    setFilterValues({});
    setSort(null);
    setSelectedIds(new Set());
    setPage(1);
  }

  const hasControls = searchable || filters.length > 0 || selectable || pageSizeOptions.length > 1;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white" data-data-table>
      {hasControls ? <div className="border-b border-slate-200 bg-slate-50/60 p-2.5">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(150px,220px))_auto]">
          {searchable ? <SearchField id="data-table-search" label={searchLabel} onChange={(value) => { setQuery(value); resetPage(); }} placeholder={searchPlaceholder} value={query} /> : null}
          {filters.map((filter) => <SelectField
            id={`data-table-filter-${filter.id}`}
            key={filter.id}
            label={filter.label}
            onChange={(value) => { setFilterValues((current) => ({ ...current, [filter.id]: value })); resetPage(); }}
            options={[{ value: '', label: filter.allLabel ?? 'Todos' }, ...filter.options]}
            value={filterValues[filter.id] ?? ''}
          />)}
          <SelectField
            id="data-table-page-size"
            label="Filas"
            onChange={(value) => { setPageSize(Number(value)); resetPage(); }}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            value={String(pageSize)}
          />
          <button className="self-end rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900" onClick={resetControls} type="button">Restablecer</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span data-data-table-count>{processedRows.length} de {rows.length} registros</span>
          {selectable ? <span className="font-semibold text-slate-700" data-data-table-selected>{selectedIds.size} seleccionados</span> : null}
        </div>
      </div> : null}

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-left text-xs">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">
            <tr>
              {selectable ? <th className="w-10 px-2.5 py-2" scope="col">
                <input aria-label="Seleccionar filas visibles" checked={allVisibleSelected} onChange={toggleVisible} type="checkbox" />
              </th> : null}
              {columns.map((column) => (
                <th className={`px-2.5 py-2 ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.className ?? ''}`} key={column.id} scope="col">
                  {column.sortable && column.sortValue ? <button className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.07em] hover:text-slate-800" onClick={() => toggleSort(column)} type="button">
                    {column.header}<span aria-hidden="true">{sort?.id === column.id ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length > 0 ? pageRows.map((row) => {
              const id = getRowId(row);
              return <tr className="transition hover:bg-slate-50/80" key={id}>
                {selectable ? <td className="px-2.5 py-2"><input aria-label={`Seleccionar ${id}`} checked={selectedIds.has(id)} onChange={() => toggleRow(id)} type="checkbox" /></td> : null}
                {columns.map((column) => <td className={`px-2.5 py-2 align-middle text-slate-600 ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.className ?? ''}`} key={column.id}>{column.cell(row)}</td>)}
              </tr>;
            }) : <tr><td className="px-2.5 py-8 text-center text-xs text-slate-500" colSpan={columns.length + (selectable ? 1 : 0)}>{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>

      {hasControls ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-2.5 py-2 text-xs text-slate-500">
        <span>Página {safePage} de {pageCount}</span>
        <div className="flex items-center gap-1" data-data-table-pagination>
          <button className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Anterior</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button aria-current={number === safePage ? 'page' : undefined} className={`rounded-md border px-2.5 py-1.5 ${number === safePage ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700' : 'border-slate-200 text-slate-600'}`} key={number} onClick={() => setPage(number)} type="button">{number}</button>)}
          <button className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">Siguiente</button>
        </div>
      </div> : null}
    </div>
  );
}
