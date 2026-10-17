import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { cartRequest, type CartLine } from '../infrastructure/storefrontApi';
import { useStorefrontSession } from './useStorefrontSession';

export function StorefrontCartPage({ provider }: { provider: StorefrontProvider }) {
  const { customer, loading, sessionError } = useStorefrontSession();
  const location = useLocation();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLines([]); setError('');
    if (!customer) return;
    setFetching(true);
    cartRequest().then(result => { if (active) setLines(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el carrito.'); })
      .finally(() => { if (active) setFetching(false); });
    return () => { active = false; };
  }, [customer]);
  async function change(line: CartLine, quantity: number) {
    setBusy(true); setError('');
    try { setLines(await cartRequest(quantity === 0 ? 'DELETE' : 'PATCH', line.product_id, quantity)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el carrito.'); }
    finally { setBusy(false); }
  }
  const money = (currency: string, amount: number) => new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount / 100);
  const totals = lines.filter(line => line.available).reduce<Record<string, number>>((acc, line) => {
    acc[line.currency_code] = (acc[line.currency_code] ?? 0) + line.quantity * line.unit_price_minor; return acc;
  }, {});
  return <section className="mx-auto max-w-4xl px-4 py-8" data-storefront-cart>
    <h1 className="text-xl font-bold">Mi carrito</h1>
    {loading ? <p role="status" className="mt-4">Comprobando sesión…</p> : !customer ? <div className="mt-4 grid gap-3">
      <p>Iniciá sesión para agregar productos y consultar tu carrito.</p>
      {sessionError && <p role="alert">{sessionError}</p>}
      <Link className="font-bold text-red-600" to="/store/account/sign-in" state={{ from: location.pathname }}>Iniciar sesión</Link>
      <Link to="/store/products">Seguir viendo productos</Link>
    </div> : <>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {fetching ? <p role="status" className="mt-4">Cargando carrito…</p> : !lines.length && !error ? <p className="mt-4">Tu carrito está vacío.</p> : null}
      <div className="mt-4 grid gap-3">{lines.map(line => <article key={line.product_id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
        <div><Link to={'/store/products/' + line.product_id} className="font-semibold">{line.title}</Link>
          <p className="mt-1 text-sm">{money(line.currency_code, line.unit_price_minor)} por unidad</p>
          {!line.available && <p className="mt-1 text-sm text-red-700">Cantidad no disponible. Ajustá la cantidad o quitá el producto.</p>}
        </div>
        <div className="flex items-center gap-3">
          <button aria-label={'Reducir cantidad de ' + line.title} disabled={busy || line.quantity <= 1 || line.stock_quantity < 1} onClick={() => { void change(line, Math.min(line.quantity - 1, line.stock_quantity)); }} className="rounded border px-3 py-1">−</button>
          <span>{line.quantity}</span>
          <button aria-label={'Aumentar cantidad de ' + line.title} disabled={busy || line.quantity >= Math.min(line.stock_quantity,999)} onClick={() => { void change(line, line.quantity + 1); }} className="rounded border px-3 py-1">+</button>
          <button disabled={busy} onClick={() => { void change(line, 0); }} className="text-sm font-semibold text-red-600">Quitar</button>
        </div>
      </article>)}</div>
      {!!lines.length && <div className="mt-5 grid gap-2 rounded-lg bg-slate-50 p-4">
        {Object.entries(totals).map(([currency, total]) => <p key={currency} className="font-bold">Subtotal: {money(currency, total)}</p>)}
        <p className="text-xs text-slate-600">El carrito no reserva stock. Precios y disponibilidad se verifican al consultarlo. El envío se paga aparte.</p>
        <Link to="/store/contact" className="font-bold text-red-600">Consultar mi compra</Link>
      </div>}
      <Link className="mt-4 inline-block text-sm font-semibold" to="/store/products">Seguir viendo productos</Link>
    </>}
    <p className="mt-5 text-xs text-slate-500">{provider.getShellView().storeName}</p>
  </section>;
}
