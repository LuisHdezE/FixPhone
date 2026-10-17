import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

test('donor catalog uses the used-phone layout with actual donor data, brand filters and price ordering', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { partsDonorCatalogCards } = await server.ssrLoadModule('/src/features/storefront/application/partsDonorCatalog.ts');
    const { discoverStorefrontProducts } = await server.ssrLoadModule('/src/features/storefront/application/storefront.discovery.ts');
    const { StorefrontCatalogProducts } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontCatalogProducts.tsx');
    const { StorefrontCatalogPage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontCatalogPage.tsx');
    const donor = {
      id: 'donor-1', brand: 'Apple', model_name: 'iPhone 11', title: 'iPhone 11 para repuestos',
      category: 'phones_for_parts', fault_type: 'icloud', fault_label: 'Bloqueo iCloud',
      screen_condition: 'good', power_state: 'yes', price_minor: 390000, currency_code: 'UYU',
      image_url: '/real-donor.jpg', images: ['/real-donor.jpg'], description: 'Unidad con falla',
      availability: 'available', href: '/store/for-parts/donor-1',
    };
    const cards = partsDonorCatalogCards([
      donor,
      { ...donor, id: 'donor-2', brand: 'Samsung', model_name: 'A22', price_minor: 200000, href: '/store/for-parts/donor-2' },
      { ...donor, id: 'ordinary-phone', category: 'phones' },
      { ...donor, id: 'unavailable', availability: 'sold' },
    ]);
    assert.equal(cards.length, 2);
    assert.equal(cards[0].href, donor.href);
    assert.equal(cards[0].badgeLabel, 'Para repuestos');
    assert.equal(cards[0].image.src, donor.image_url);
    assert.equal(cards[0].subtitle, donor.fault_label);
    assert.equal(cards[0].stockLabel, '1 unidad disponible');
    assert.deepEqual(discoverStorefrontProducts(cards, { searchText: '', filters: { brand: 'apple' } }).products.map(x => x.id), ['donor-1']);
    assert.deepEqual(discoverStorefrontProducts(cards, { searchText: '', sortId: 'price_asc' }).products.map(x => x.id), ['donor-2', 'donor-1']);
    assert.deepEqual(discoverStorefrontProducts(cards, { searchText: '', sortId: 'price_desc' }).products.map(x => x.id), ['donor-1', 'donor-2']);
    const unknown = partsDonorCatalogCards([{ ...donor, brand: null }])[0];
    assert.equal(unknown.brandLabel, 'Sin marca');
    assert.equal(unknown.discoveryFacets.brand, 'other');

    const render = element => renderToString(createElement(MemoryRouter, null, element));
    const used = render(createElement(StorefrontCatalogPage, {
      provider: { getCatalogView: () => ({}), getCatalogRouteView: () => ({ key: 'used-phones', products: cards }) },
      routeKey: 'used-phones',
    }));
    const parts = render(createElement(StorefrontCatalogProducts, { catalogKey: 'for-parts', products: cards }));
    const normalize = html => html.replace(/ data-storefront-catalog-route-key="[^"]*"/g, '').replace(/ data-parts-donor-catalog="true"/g, '');
    assert.equal(normalize(used), normalize(parts));
    assert.equal((parts.match(/data-storefront-listing-product-card/g) ?? []).length, 2);
    assert.match(parts, /Ordenar por/);
    assert.match(parts, /Marca/);
    assert.doesNotMatch(parts, /ordinary-phone|unavailable|Celulares usados funcionales/);
    const pending = render(createElement(StorefrontCatalogProducts, { catalogKey: 'for-parts', products: cards, pending: true }));
    assert.match(pending, /role="status"/);
    assert.doesNotMatch(pending, /data-storefront-listing-product-card/);
    const error = render(createElement(StorefrontCatalogProducts, { catalogKey: 'for-parts', products: [], error: 'Error de disponibilidad' }));
    assert.match(error, /role="alert"/);
    const empty = render(createElement(StorefrontCatalogProducts, { catalogKey: 'for-parts', products: [], emptyMessage: 'Sin equipos' }));
    assert.match(empty, /Sin equipos/);
  } finally { await server.close(); }
});
