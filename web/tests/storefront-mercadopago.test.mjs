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

test('payment return keeps polling beyond the first cron minute and exposes manual refresh', async () => {
  const source = await readFile(new URL('../src/features/storefront/presentation/StorefrontPaymentReturnPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /Actualizar estado/);

  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { nextPaymentPollDelay, PAYMENT_RETURN_POLL_INTERVAL_MS, PAYMENT_RETURN_POLL_WINDOW_MS } =
      await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontPaymentReturnPage.tsx');
    const pending = {
      id: 'order-1', order_number: 'FP-1', status: 'expired', payment_status: 'pending',
      payment_status_detail: 'pending_contingency', payment_review_reason: null,
      preference_id: 'pref-1', total_amount_minor: 1000, currency_code: 'UYU',
      reservation_expires_at: new Date().toISOString(), paid_at: null,
    };
    const approved = { ...pending, status: 'paid', payment_status: 'approved' };

    assert.ok(PAYMENT_RETURN_POLL_WINDOW_MS >= 120_000);
    assert.equal(nextPaymentPollDelay(pending, 65_000), PAYMENT_RETURN_POLL_INTERVAL_MS);
    assert.equal(nextPaymentPollDelay(pending, 120_000), PAYMENT_RETURN_POLL_INTERVAL_MS);
    assert.equal(nextPaymentPollDelay(approved, 65_000), null);
  } finally {
    await server.close();
  }
});
