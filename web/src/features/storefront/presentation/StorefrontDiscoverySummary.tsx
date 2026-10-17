interface StorefrontDiscoverySummaryProps {
  resultCount: number;
  totalCount: number;
  activeFilterCount: number;
  sortLabel: string;
  hasActiveCriteria: boolean;
  onClear: () => void;
}

/** Search information only: independent of product-card styling and sizing. */
export function StorefrontDiscoverySummary({
  resultCount, totalCount, activeFilterCount, sortLabel, hasActiveCriteria, onClear,
}: StorefrontDiscoverySummaryProps) {
  return <div className="fp-discovery-summary" data-storefront-discovery-summary>
    <div className="fp-discovery-summary-copy">
      <p className="fp-discovery-summary-count" data-storefront-discovery-count>
        {resultCount} de {totalCount} productos
      </p>
      <p className="fp-discovery-summary-criteria">
        Búsqueda + {activeFilterCount} filtro{activeFilterCount === 1 ? '' : 's'} activo{activeFilterCount === 1 ? '' : 's'} · orden: {sortLabel}
      </p>
    </div>
    {hasActiveCriteria ? <button
      className="fp-discovery-summary-clear"
      data-storefront-discovery-clear
      onClick={onClear}
      type="button"
    >Limpiar criterios</button> : null}
  </div>;
}
