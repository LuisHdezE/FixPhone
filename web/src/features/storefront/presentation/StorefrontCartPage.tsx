import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { cartRequest, startStoreCheckout, type CartLine, type StoreCheckoutOrder } from '../infrastructure/storefrontApi';
import { useStorefrontSession } from './useStorefrontSession';
import { StorefrontIcon } from './StorefrontIcon';

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount / 100);
}

export function StorefrontCartPage({ provider }: { provider: StorefrontProvider }) {
  const { customer, loading, sessionError } = useStorefrontSession();
  const location = useLocation();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fetching, setFetching] = useState(false);
  const [busyProduct, setBusyProduct] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<StoreCheckoutOrder | null>(null);
  const checkoutKey = useRef<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLines([]); setError(''); setCreatedOrder(null); checkoutKey.current = null;
    if (!customer) return;
    setFetching(true);
    cartRequest().then(result => { if (active) setLines(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el carrito.'); })
      .finally(() => { if (active) setFetching(false); });
    return () => { active = false; };
  }, [customer]);

  async function change(line: CartLine, quantity: number) {
    setBusyProduct(line.product_id); setError('');
    try {
      setLines(await cartRequest(quantity === 0 ? 'DELETE' : 'PATCH', line.product_id, quantity));
      setCreatedOrder(null); checkoutKey.current = null;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el carrito.'); }
    finally { setBusyProduct(null); }
  }

  async function checkout() {
    setStartingCheckout(true); setError('');
    try {
      checkoutKey.current ??= `fpstore_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const order = await startStoreCheckout(checkoutKey.current);
      setCreatedOrder(order);
      setStartingCheckout(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo registrar el pedido.');
      setStartingCheckout(false);
    }
  }

  const totals = lines.filter(line => line.available).reduce<Record<string, number>>((acc, line) => {
    acc[line.currency_code] = (acc[line.currency_code] ?? 0) + line.quantity * line.unit_price_minor;
    return acc;
  }, {});
  const units = lines.reduce((count, line) => count + line.quantity, 0);
  const unavailable = lines.some(line => !line.available);

  return <section className="fp-cart mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:py-8" data-storefront-cart aria-label={`Carrito de ${provider.getShellView().storeName}`}>
    <h1 className="fp-cart-title">Mi carrito</h1>
    {loading ? <p role="status" className="fp-cart-state">Comprobando sesión…</p> : !customer ? <div className="fp-cart-empty">
      <StorefrontIcon name="cart" />
      <p>Iniciá sesión para agregar productos y consultar tu carrito.</p>
      {sessionError && <p role="alert" className="fp-cart-error">{sessionError}</p>}
      <Link className="fp-cart-primary" to="/store/account/sign-in" state={{ from: location.pathname }}>Iniciar sesión</Link>
      <Link className="fp-cart-text-link" to="/store/products">Seguir viendo productos</Link>
    </div> : <>
      {error && <p role="alert" className="fp-cart-error">{error}</p>}
      {createdOrder && <div role="status" className="fp-cart-summary-note">
        <strong>Pedido {createdOrder.order_number} registrado.</strong>
        <span> Total: {money(createdOrder.currency_code, createdOrder.total_amount_minor)}. El pago todavía no se inició.</span>
      </div>}
      {fetching ? <p role="status" className="fp-cart-state">Cargando carrito…</p> : !lines.length && !error ? <div className="fp-cart-empty">
        <StorefrontIcon name="cart" />
        <p>Tu carrito está vacío.</p>
        <Link className="fp-cart-primary" to="/store/products">Explorar productos</Link>
      </div> : null}
      {!!lines.length && <div className="fp-cart-layout">
        <div className="fp-cart-items">
          <div className="fp-cart-items-heading"><StorefrontIcon name="truck" /><div>
            <h2>Productos de FixPhone</h2>
            <p>Envíos a Montevideo y al interior del país. El costo de envío lo paga el cliente.</p>
          </div></div>
          {lines.map(line => <article key={line.product_id} className="fp-cart-item">
            <div className="fp-cart-photo">
              {line.image_url ? <img src={line.image_url} alt="" loading="lazy" /> : <StorefrontIcon name="phone" />}
            </div>
            <div className="fp-cart-item-main">
              <Link to={'/store/products/' + line.product_id} className="fp-cart-item-title">{line.title}</Link>
              <p className="fp-cart-unit-price">{money(line.currency_code, line.unit_price_minor)} por unidad</p>
              {!line.available && <p className="fp-cart-stock" role="status">Cantidad no disponible. Ajustá la cantidad o quitá el producto.</p>}
              <div className="fp-cart-actions">
                <div className="fp-cart-quantity" aria-label={`Cantidad de ${line.title}`}>
                  <button type="button" aria-label={'Reducir cantidad de ' + line.title} disabled={startingCheckout || busyProduct !== null || line.quantity <= 1 || line.stock_quantity < 1} onClick={() => { void change(line, Math.min(line.quantity - 1, line.stock_quantity)); }}>−</button>
                  <span aria-live="polite">{line.quantity}</span>
                  <button type="button" aria-label={'Aumentar cantidad de ' + line.title} disabled={startingCheckout || busyProduct !== null || line.quantity >= Math.min(line.stock_quantity, 999)} onClick={() => { void change(line, line.quantity + 1); }}>+</button>
                </div>
                <button type="button" className="fp-cart-remove" aria-label={'Quitar ' + line.title + ' del carrito'} title="Quitar del carrito" disabled={startingCheckout || busyProduct !== null} onClick={() => { void change(line, 0); }}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg>
                </button>
              </div>
            </div>
            <p className="fp-cart-line-price">{money(line.currency_code, line.quantity * line.unit_price_minor)}</p>
          </article>)}
          <p className="fp-cart-delivery"><StorefrontIcon name="truck" /> Coordinamos el envío a Montevideo o al interior al consultar tu compra.</p>
          <Link className="fp-cart-text-link fp-cart-continue" to="/store/products">← Seguir viendo productos</Link>
        </div>
        <aside className="fp-cart-summary" aria-label="Detalle de la compra">
          <h2>Detalle de la compra</h2>
          <div className="fp-cart-summary-row"><span>Productos ({units})</span><span>{lines.length} {lines.length === 1 ? 'artículo' : 'artículos'}</span></div>
          {Object.entries(totals).map(([currency, total]) => <div key={currency} className="fp-cart-total">
            <span>Subtotal {Object.keys(totals).length > 1 ? currency : ''}</span><strong>{money(currency, total)}</strong>
          </div>)}
          {unavailable && <p className="fp-cart-stock">Los productos sin disponibilidad no se incluyen en el subtotal.</p>}
          <p className="fp-cart-summary-note">El envío se paga aparte. El precio y la disponibilidad se verifican al consultar; el carrito no reserva stock.</p>
          <button type="button" className="fp-cart-primary" disabled={startingCheckout || !!createdOrder || fetching || unavailable || lines.length === 0} onClick={() => { void checkout(); }}>
            {startingCheckout ? 'Registrando pedido…' : createdOrder ? 'Pedido registrado' : 'Continuar al pago'}
          </button>
        </aside>
      </div>}
    </>}
  </section>;
}
