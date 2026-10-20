import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

test('checkout pro has one wired Mercado Pago CTA', async () => {
  const cart = await readFile(new URL('../src/features/storefront/presentation/StorefrontCartPage.tsx', import.meta.url), 'utf8');
  assert.equal((cart.match(/data-mp-checkout-cta="checkout-pro"/g) ?? []).length, 1);
  assert.match(cart, /Pagar con Mercado Pago/);
  assert.match(cart, /\/api\/v1\/store\/checkout/);
  assert.match(cart, /window\.location\.assign\(init_point\)/);
});

test('browser return is informational and requires an authenticated local order lookup', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { StorefrontSessionContext } = await server.ssrLoadModule('/src/features/storefront/presentation/storefrontSession.context.ts');
    const { StorefrontPaymentReturnPage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontPaymentReturnPage.tsx');
    const render = (customer, url) => renderToString(createElement(MemoryRouter, { initialEntries: [url] },
      createElement(StorefrontSessionContext.Provider, {
        value: { customer, loading: false, sessionError: '', signIn: async () => {}, signOut: async () => {} },
      }, createElement(StorefrontPaymentReturnPage))));

    assert.match(render(null, '/store/payment/return?order_id=forged'), /Iniciá sesión para consultar/);
    assert.match(render({ id: 'customer-1', name: 'Cliente', email: 'c@test', permissions: [] }, '/store/payment/return'), /No recibimos el identificador/);
  } finally {
    await server.close();
  }
});
