import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router';

test('storefront product detail gallery correctly reflects image priority, multiple thumbnails, and single image clean state', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { StorefrontSessionContext } = await server.ssrLoadModule('/src/features/storefront/presentation/storefrontSession.context.ts');
    const { StorefrontProductDetailPage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontProductDetailPage.tsx');
    const { ApiStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/ApiStorefrontProvider.ts');

    const value = { customer: null, loading: false, sessionError: '', signIn: async () => {}, signOut: async () => {} };

    // Scenario 1: Device with 4 real confirmed photos
    const providerWith4Photos = new ApiStorefrontProvider([
      {
        id: 'phone-4-photos',
        title: 'iPhone 13 128GB Azul',
        item_type: 'used_phone',
        operational_status: 'disponible',
        sale_price_amount_minor: 2500000,
        currency_code: 'UYU',
        stock_quantity: 1,
        brand: 'Apple',
        model: 'iPhone 13',
        main_image_url: 'https://r2.fixphone.test/generic-model-fallback.webp',
        photos: [
          { id: 'p1', url: 'https://r2.fixphone.test/real-photo-1.webp', is_primary: true },
          { id: 'p2', url: 'https://r2.fixphone.test/real-photo-2.webp', is_primary: false },
          { id: 'p3', url: 'https://r2.fixphone.test/real-photo-3.webp', is_primary: false },
          { id: 'p4', url: 'https://r2.fixphone.test/real-photo-4.webp', is_primary: false },
        ],
      },
    ]);

    const html4 = renderToString(
      createElement(MemoryRouter, { initialEntries: ['/store/products/phone-4-photos'] },
        createElement(StorefrontSessionContext.Provider, { value },
          createElement(Routes, null,
            createElement(Route, { path: '/store/products/:slug', element: createElement(StorefrontProductDetailPage, { provider: providerWith4Photos }) }),
          ),
        ),
      ),
    );

    // Verifications for 4 real photos:
    // 1. Must render main image with first photo
    assert.match(html4, /src="https:\/\/r2\.fixphone\.test\/real-photo-1\.webp"/);
    // 2. Must render counter 1 / 4
    assert.match(html4, /1 \/ 4/);
    // 3. Must render prev and next buttons
    assert.match(html4, /aria-label="Foto anterior"/);
    assert.match(html4, /aria-label="Foto siguiente"/);
    // 4. Must render thumbnails strip below
    assert.match(html4, /aria-label="Fotos del producto"/);
    assert.match(html4, /aria-label="Ver foto 1"/);
    assert.match(html4, /aria-label="Ver foto 2"/);
    assert.match(html4, /aria-label="Ver foto 3"/);
    assert.match(html4, /aria-label="Ver foto 4"/);
    // 5. Must NOT mix generic model fallback image
    assert.doesNotMatch(html4, /generic-model-fallback\.webp/);

    // Scenario 2: Device with 0 real photos (falls back to generic model image)
    const providerWith0Photos = new ApiStorefrontProvider([
      {
        id: 'phone-0-photos',
        title: 'iPhone 12 64GB Negro',
        item_type: 'used_phone',
        operational_status: 'disponible',
        sale_price_amount_minor: 1800000,
        currency_code: 'UYU',
        stock_quantity: 1,
        brand: 'Apple',
        model: 'iPhone 12',
        main_image_url: 'https://r2.fixphone.test/generic-model-fallback.webp',
        photos: [],
      },
    ]);

    const html0 = renderToString(
      createElement(MemoryRouter, { initialEntries: ['/store/products/phone-0-photos'] },
        createElement(StorefrontSessionContext.Provider, { value },
          createElement(Routes, null,
            createElement(Route, { path: '/store/products/:slug', element: createElement(StorefrontProductDetailPage, { provider: providerWith0Photos }) }),
          ),
        ),
      ),
    );

    // 1. Must render fallback model image
    assert.match(html0, /src="https:\/\/r2\.fixphone\.test\/generic-model-fallback\.webp"/);
    // 2. Must NOT render prev/next buttons
    assert.doesNotMatch(html0, /aria-label="Foto anterior"/);
    assert.doesNotMatch(html0, /aria-label="Foto siguiente"/);
    // 3. Must NOT render counter
    assert.doesNotMatch(html0, /data-storefront-gallery-counter/);
    // 4. Must NOT render thumbnail strip
    assert.doesNotMatch(html0, /aria-label="Fotos del producto"/);

    // Scenario 3: Device with 1 single real photo
    const providerWith1Photo = new ApiStorefrontProvider([
      {
        id: 'phone-1-photo',
        title: 'iPhone 11 64GB Blanco',
        item_type: 'used_phone',
        operational_status: 'disponible',
        sale_price_amount_minor: 1400000,
        currency_code: 'UYU',
        stock_quantity: 1,
        brand: 'Apple',
        model: 'iPhone 11',
        main_image_url: 'https://r2.fixphone.test/generic-model-fallback.webp',
        photos: [
          { id: 'p1', url: 'https://r2.fixphone.test/single-real-photo.webp', is_primary: true },
        ],
      },
    ]);

    const html1 = renderToString(
      createElement(MemoryRouter, { initialEntries: ['/store/products/phone-1-photo'] },
        createElement(StorefrontSessionContext.Provider, { value },
          createElement(Routes, null,
            createElement(Route, { path: '/store/products/:slug', element: createElement(StorefrontProductDetailPage, { provider: providerWith1Photo }) }),
          ),
        ),
      ),
    );

    // 1. Must render the single real photo
    assert.match(html1, /src="https:\/\/r2\.fixphone\.test\/single-real-photo\.webp"/);
    // 2. Must NOT mix fallback image
    assert.doesNotMatch(html1, /generic-model-fallback\.webp/);
    // 3. Must NOT render buttons, counter or single-thumbnail strip
    assert.doesNotMatch(html1, /aria-label="Foto anterior"/);
    assert.doesNotMatch(html1, /aria-label="Foto siguiente"/);
    assert.doesNotMatch(html1, /data-storefront-gallery-counter/);
    assert.doesNotMatch(html1, /aria-label="Fotos del producto"/);
  } finally {
    await server.close();
  }
});
