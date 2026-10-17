import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

test('search summary is independent and results do not stretch to the sidebar height', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { StorefrontProductListingPage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontProductListingPage.tsx');
    const { StorefrontDiscoverySummary } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontDiscoverySummary.tsx');
    const { ApiStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/ApiStorefrontProvider.ts');
    const provider = new ApiStorefrontProvider(Array.from({ length: 5 }, (_, index) => ({
      id: 'layout-' + index, title: index === 0 ? 'Samsung A22 unidad unica' : 'Samsung A22 ' + index, item_type: 'used_phone',
      operational_status: 'en_stock', sale_price_amount_minor: 20000,
      currency_code: 'UYU', stock_quantity: 1, brand: 'Samsung', model: 'A22',
    })));
    for (const query of ['', '?q=Samsung', '?q=unidad', '?q=missing-product']) {
      const html = renderToString(createElement(MemoryRouter, { initialEntries: ['/store/products' + query] },
        createElement(StorefrontProductListingPage, { provider })));
      assert.match(html, /grid items-start gap-3 lg:grid-cols/);
      assert.match(html, /class="flex min-w-0 flex-col gap-3" data-storefront-discovery-content/);
      assert.equal((html.match(/data-storefront-discovery-summary/g) ?? []).length, 1);
      assert.match(html, /fp-discovery-summary/);
      if (query.includes('missing')) assert.match(html, /data-storefront-listing-empty-state/);
      else {
        assert.match(html, /grid content-start items-start gap-3/);
        assert.equal((html.match(/data-storefront-listing-product-card/g) ?? []).length, query.includes('unidad') ? 1 : 5);
      }
    }
    const renderSummary = (active) => renderToString(createElement(StorefrontDiscoverySummary, {
      resultCount: 4, totalCount: 5, activeFilterCount: 0, sortLabel: 'Recomendados',
      hasActiveCriteria: active, onClear: () => {},
    }));
    assert.match(renderSummary(true), /data-storefront-discovery-clear/);
    assert.doesNotMatch(renderSummary(false), /data-storefront-discovery-clear/);
    assert.doesNotMatch(renderSummary(true), /fp-product/);
    const css = await readFile('src/styles/storefront.css', 'utf8');
    assert.doesNotMatch(css, /\[data-storefront-listing-product-card\]/);
    assert.match(css, /\.fp-discovery-summary\{display:flex;flex:0 0 auto/);
  } finally { await server.close(); }
});
