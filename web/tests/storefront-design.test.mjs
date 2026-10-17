import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

test('carousel renders accessible navigation for multiple slides, a simple single slide, and no empty hero', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { StorefrontHeroCarousel } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontHeroCarousel.tsx');
    const { JsonStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/JsonStorefrontProvider.ts');
    const banners = new JsonStorefrontProvider().getHomeView().heroBanners;
    const render = value => renderToString(createElement(MemoryRouter, null, createElement(StorefrontHeroCarousel, { banners: value })));
    const all = render(banners);
    assert.match(all, /Tu próximo celular está acá/);
    assert.match(all, /Anuncio siguiente/);
    assert.match(all, /Anuncio anterior/);
    assert.match(all, /Reproducir carrusel/);
    assert.match(all, /aria-current="true"/);
    assert.match(all, /href="\/store\/used-phones"/);
    const single = render(banners.slice(0, 1));
    assert.doesNotMatch(single, /Anuncio siguiente|Reproducir carrusel/);
    assert.equal(render([]), '');
  } finally { await server.close(); }
});

test('home renders actual inventory prices and preserves donor access without fabricated empty stock', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { StorefrontHomePage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontHomePage.tsx');
    const { ApiStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/ApiStorefrontProvider.ts');
    const item = { id:'phone-real', title:'Samsung A22 real', item_type:'used_phone', operational_status:'en_stock', sale_price_amount_minor:432100, currency_code:'UYU', stock_quantity:1, brand:'Samsung', model:'A22' };
    const provider = new ApiStorefrontProvider([item]);
    const render = value => renderToString(createElement(MemoryRouter, null, createElement(StorefrontHomePage, { provider: value })));
    const html = render(provider);
    assert.match(html, /Samsung A22 real/);
    assert.ok(html.includes(provider.getHomeView().productSection.products[0].priceLabel.replaceAll('&','&amp;')));
    assert.match(html, /href="\/store\/for-parts"/);
    assert.match(html, /href="https:\/\/wa.me\/59898901428"/);
    const empty = render(new ApiStorefrontProvider([]));
    assert.match(empty, /Estamos preparando nuevos productos/);
    assert.doesNotMatch(empty, /data-storefront-product-card/);
  } finally { await server.close(); }
});
