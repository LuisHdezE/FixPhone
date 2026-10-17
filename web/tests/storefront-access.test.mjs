import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router';

test('store access returns only to internal store pages and shows administration only with permissions', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { safeStoreReturn, canAccessAdministration } = await server.ssrLoadModule('/src/features/storefront/infrastructure/storefrontApi.ts');
    assert.equal(safeStoreReturn('/store/products/phone-1'), '/store/products/phone-1');
    assert.equal(safeStoreReturn('/store/cart?q=1'), '/store/cart?q=1');
    for (const value of [null, undefined, 'https://evil.test', '//evil.test', '/admin', '/storefront', '/store\\evil', '/store/\n']) {
      assert.equal(safeStoreReturn(value), '/store');
    }
    assert.equal(canAccessAdministration([]), false);
    assert.equal(canAccessAdministration(['catalog.manage']), true);
    const { StorefrontShell } = await server.ssrLoadModule('/src/shell/StorefrontShell.tsx');
    const { StorefrontSessionContext } = await server.ssrLoadModule('/src/features/storefront/presentation/storefrontSession.context.ts');
    const { JsonStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/JsonStorefrontProvider.ts');
    const render = customer => renderToString(createElement(MemoryRouter, null,
      createElement(StorefrontSessionContext.Provider, { value: { customer, loading:false, sessionError:'', signIn:async()=>{}, signOut:async()=>{} } },
        createElement(StorefrontShell, { provider:new JsonStorefrontProvider() }))));
    assert.doesNotMatch(render(null), /aria-label="Administración"/);
    assert.doesNotMatch(render({name:'Cliente',email:'c@test',permissions:[]}), /aria-label="Administración"/);
    assert.match(render({name:'Admin',email:'a@test',permissions:['catalog.manage']}), /aria-label="Administración"/);
  } finally { await server.close(); }
});

test('cart renders no demonstration inventory for guests and product exposes sign-in requirement', async () => {
  const server = await createServer({ server: { middlewareMode:true, hmr:false }, appType:'custom' });
  try {
    const { StorefrontSessionContext } = await server.ssrLoadModule('/src/features/storefront/presentation/storefrontSession.context.ts');
    const { StorefrontCartPage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontCartPage.tsx');
    const { StorefrontProductDetailPage } = await server.ssrLoadModule('/src/features/storefront/presentation/StorefrontProductDetailPage.tsx');
    const { JsonStorefrontProvider } = await server.ssrLoadModule('/src/features/storefront/infrastructure/JsonStorefrontProvider.ts');
    const provider = new JsonStorefrontProvider();
    const value = {customer:null,loading:false,sessionError:'',signIn:async()=>{},signOut:async()=>{}};
    const cart = renderToString(createElement(MemoryRouter, null, createElement(StorefrontSessionContext.Provider,{value},createElement(StorefrontCartPage,{provider}))));
    assert.match(cart,/Iniciar sesión/);
    assert.doesNotMatch(cart,/Display|Batería|Restaurar|producto.*en carrito/);
    const product = provider.getProductDetailView().products[0];
    const html = renderToString(createElement(MemoryRouter,{initialEntries:['/store/products/'+product.slug]},
      createElement(StorefrontSessionContext.Provider,{value},createElement(Routes,null,
        createElement(Route,{path:'/store/products/:slug',element:createElement(StorefrontProductDetailPage,{provider})})))));
    assert.match(html,/Agregar al carrito/);
    assert.match(html,/Iniciá sesión para agregar al carrito/);
    assert.doesNotMatch(html,/Carrito pendiente/);
  } finally { await server.close(); }
});
