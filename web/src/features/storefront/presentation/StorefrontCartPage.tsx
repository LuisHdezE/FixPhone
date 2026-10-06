import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { StorefrontCartLineDto, StorefrontMediaDto } from '../application/storefront.dto';
import type { StorefrontProvider } from '../application/storefront.contracts';
import {
  deriveStorefrontCart,
  formatCartMoney,
  getInitialCartQuantities,
  setCartLineQuantity,
} from '../application/storefront.cart';

interface StorefrontCartPageProps {
  provider: StorefrontProvider;
}

interface CartLineRowProps {
  line: StorefrontCartLineDto;
  image: StorefrontMediaDto | undefined;
  quantity: number;
  lineTotalLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}

function CartLineRow({
  line,
  image,
  quantity,
  lineTotalLabel,
  onDecrease,
  onIncrease,
  onRemove,
}: CartLineRowProps) {
  return (
    <article
      className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 border-b border-slate-200 py-3 sm:grid-cols-[4.75rem_minmax(0,1fr)_7rem_7rem] sm:items-center"
      data-storefront-cart-line
      data-storefront-cart-line-id={line.id}
    >
      <Link className="block overflow-hidden rounded-md bg-slate-100" to={line.href}>
        {image ? (
          <img
            alt={image.alt}
            className="aspect-square h-[4.75rem] w-[4.75rem] object-cover"
            src={image.src}
            style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
          />
        ) : (
          <span className="grid aspect-square h-[4.75rem] w-[4.75rem] place-items-center bg-[var(--storefront-primary-soft)] text-[9px] font-black uppercase tracking-[0.12em] text-[var(--storefront-primary-strong)]">
            {line.badgeLabel}
          </span>
        )}
      </Link>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--storefront-primary-strong)]">{line.badgeLabel}</p>
        <Link className="mt-0.5 block truncate text-[12px] font-bold text-slate-950 hover:underline" to={line.href}>
          {line.title}
        </Link>
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{line.subtitle}</p>
        <p className="mt-1 text-[10px] text-slate-500">{line.compatibilityLabel}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{line.stockLabel}</p>
        <button
          className="mt-1 text-[9px] font-bold text-rose-600 hover:underline"
          data-storefront-cart-remove
          onClick={onRemove}
          type="button"
        >
          Eliminar
        </button>
      </div>

      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto sm:justify-center" data-storefront-cart-quantity>
        <button
          aria-label={`Reducir cantidad de ${line.title}`}
          className="grid size-7 place-items-center rounded border border-slate-300 bg-white text-[12px] font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          data-storefront-cart-decrease
          disabled={quantity <= 1}
          onClick={onDecrease}
          type="button"
        >
          −
        </button>
        <span className="min-w-5 text-center text-[11px] font-black text-slate-950" data-storefront-cart-quantity-value>{quantity}</span>
        <button
          aria-label={`Aumentar cantidad de ${line.title}`}
          className="grid size-7 place-items-center rounded border border-slate-300 bg-white text-[12px] font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          data-storefront-cart-increase
          disabled={quantity >= line.maxQuantity}
          onClick={onIncrease}
          type="button"
        >
          +
        </button>
      </div>

      <div className="col-start-2 flex items-baseline justify-between gap-3 sm:col-start-auto sm:block sm:text-right">
        <span className="text-[10px] text-slate-500 sm:hidden">Total</span>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">Unidad</p>
          <p className="text-[11px] font-semibold text-slate-600">{line.unitPriceLabel}</p>
          <p className="mt-0.5 text-[12px] font-black text-slate-950" data-storefront-cart-line-total>{lineTotalLabel}</p>
        </div>
      </div>
    </article>
  );
}

export function StorefrontCartPage({ provider }: StorefrontCartPageProps) {
  const cart = provider.getCartView();
  const listing = provider.getProductListingView();
  const imageByHref = new Map(listing.products.map((product) => [product.href, product.image]));
  const initialQuantities = useMemo(() => getInitialCartQuantities(cart.lines), [cart.lines]);
  const [quantities, setQuantities] = useState(initialQuantities);
  const interactiveCart = useMemo(
    () => deriveStorefrontCart(cart.lines, quantities),
    [cart.lines, quantities],
  );

  const currencyCode = interactiveCart.currencyCode ?? cart.lines[0]?.currencyCode ?? 'UYU';
  const subtotalLabel = interactiveCart.hasMixedCurrencies
    ? 'Múltiples monedas'
    : formatCartMoney(currencyCode, interactiveCart.subtotalMinor);

  const updateQuantity = (line: StorefrontCartLineDto, nextQuantity: number) => {
    setQuantities((current) => setCartLineQuantity(current, line, nextQuantity));
  };

  const clearCart = () => setQuantities({});
  const restoreCart = () => setQuantities(initialQuantities);

  return (
    <main className="bg-white" data-storefront-cart>
      <section className="mx-auto max-w-[1440px] px-4 py-3 sm:px-5 lg:px-6">
        <nav className="mb-2 text-[9px] text-slate-500" aria-label="Breadcrumb">
          <Link className="hover:text-slate-800" to="/store">Inicio</Link>
          <span className="px-1">›</span>
          <span>Carrito</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h1 className="text-[18px] font-black tracking-[-0.02em] text-slate-950">{cart.title}</h1>
                <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-slate-500">{cart.description}</p>
              </div>
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                {cart.cartStateLabel}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between bg-[var(--storefront-primary-soft)] px-3 py-2 text-[10px] font-semibold text-[var(--storefront-primary-strong)]">
              <span>✓ Envío por zona disponible en el checkout demo</span>
              <Link className="font-black hover:underline" to="/store/shipping">Ver zonas</Link>
            </div>

            {interactiveCart.lines.length === 0 ? (
              <section className="mt-3 border border-dashed border-slate-300 p-4" data-storefront-cart-empty-state>
                <h2 className="text-[13px] font-black text-slate-950">{cart.emptyState.title}</h2>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Quitaste todas las líneas del carrito local. Puedes restaurar los datos demo o volver al catálogo.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded bg-[var(--storefront-primary)] px-3 py-1.5 text-[10px] font-black text-[var(--storefront-on-primary)]"
                    data-storefront-cart-restore
                    onClick={restoreCart}
                    type="button"
                  >
                    Restaurar carrito demo
                  </button>
                  <Link className="rounded border border-slate-300 px-3 py-1.5 text-[10px] font-black text-slate-700" to={cart.emptyState.actionHref}>
                    {cart.emptyState.actionLabel}
                  </Link>
                </div>
              </section>
            ) : (
              <section className="mt-1" data-storefront-cart-lines>
                <div className="flex items-center justify-between border-b border-slate-200 py-2 text-[10px]">
                  <p className="font-semibold text-slate-700" data-storefront-cart-item-count>
                    {interactiveCart.itemCount} producto{interactiveCart.itemCount === 1 ? '' : 's'} en carrito
                  </p>
                  <button className="font-bold text-rose-600 hover:underline" data-storefront-cart-clear onClick={clearCart} type="button">
                    Vaciar carrito
                  </button>
                </div>
                {interactiveCart.lines.map(({ line, quantity, lineTotalMinor }) => (
                  <CartLineRow
                    key={line.id}
                    image={imageByHref.get(line.href)}
                    line={line}
                    lineTotalLabel={formatCartMoney(line.currencyCode, lineTotalMinor)}
                    onDecrease={() => updateQuantity(line, quantity - 1)}
                    onIncrease={() => updateQuantity(line, quantity + 1)}
                    onRemove={() => updateQuantity(line, 0)}
                    quantity={quantity}
                  />
                ))}
              </section>
            )}

            <section className="mt-3 border-t border-slate-200 pt-2" data-storefront-cart-notices>
              <p className="text-[9px] leading-4 text-slate-400">
                {cart.notices.map((notice) => notice.description).join(' · ')}
              </p>
            </section>
          </section>

          <aside className="h-fit border-l border-slate-200 pl-5 lg:sticky lg:top-20" data-storefront-cart-summary>
            <h2 className="text-[12px] font-black text-slate-950">{cart.summary.title}</h2>

            <dl className="mt-3 space-y-2">
              {cart.summary.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-[10px]">
                  <dt className="text-slate-600">{item.label}</dt>
                  <dd className={item.tone === 'strong' ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}>
                    {item.id === 'subtotal' ? subtotalLabel : item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-end justify-between gap-3">
                <p className="text-[10px] text-slate-600">{cart.summary.totalLabel}</p>
                <p className="text-[18px] font-black text-slate-950" data-storefront-cart-total>{subtotalLabel}</p>
              </div>

              {interactiveCart.lines.length > 0 ? (
                <Link
                  className="mt-3 flex w-full items-center justify-center rounded-full bg-[var(--storefront-primary)] px-3 py-2 text-[10px] font-black text-[var(--storefront-on-primary)]"
                  data-storefront-cart-checkout
                  to={cart.summary.checkoutPreviewHref}
                >
                  {cart.summary.checkoutLabel}
                </Link>
              ) : (
                <button
                  className="mt-3 w-full cursor-not-allowed rounded-full bg-[var(--storefront-primary)] px-3 py-2 text-[10px] font-black text-[var(--storefront-on-primary)] opacity-50"
                  disabled
                  type="button"
                >
                  Carrito vacío
                </button>
              )}

              <p className="mt-2 text-[9px] leading-4 text-slate-400">
                El checkout continúa siendo demo: no cobra, reserva stock ni crea una orden.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
