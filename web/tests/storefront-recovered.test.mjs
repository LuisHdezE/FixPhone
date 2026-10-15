import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('published recovered inventory populates listing, home and product detail with correct money', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { ApiStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/ApiStorefrontProvider.ts');
    const provider = new ApiStorefrontProvider([{ id: 'part-1', title: 'Batería iPhone 11', description: 'Batería recuperada', item_type: 'spare_part', operational_status: 'en_stock', sale_price_amount_minor: 12345, currency_code: 'USD', stock_quantity: 2, brand: 'Apple', model: 'iPhone 11', metadata: { origin: 'recovered', part_condition: 'functional' } }]);
    const card = provider.getProductListingView().products[0];
    assert.equal(card.badgeLabel, 'Usado recuperado');
    assert.equal(card.discoveryFacets.condition, 'recovered');
    assert.match(card.priceLabel, /123[,.]45/);
    assert.equal(card.stockLabel, '2 unidades disponibles');
    assert.equal(provider.getHomeView().productSection.products[0].id, 'part-1');
    const detail = provider.getProductDetailBySlug('part-1');
    assert.equal(detail.description, 'Batería recuperada');
    assert.equal(detail.image.src, '/images/part-placeholder.svg');
    assert.equal(provider.getProductDetailBySlug('product-used-iphone'), undefined);
    assert.equal(provider.getCatalogRouteView('spare-parts').products.length, 1);
    const empty = new ApiStorefrontProvider([]);
    assert.equal(empty.getProductDetailView().products.length, 0);
    assert.equal(empty.getHomeView().productSection.products.length, 0);
  } finally { await server.close(); }
});
