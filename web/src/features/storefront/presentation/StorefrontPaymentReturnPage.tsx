import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { readStoreOrderStatus, type StoreOrderStatus } from '../infrastructure/storefrontApi';
import { useStorefrontSession } from './useStorefrontSession';

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount / 100);
}

export const PAYMENT_RETURN_POLL_INTERVAL_MS = 5_000;
export const PAYMENT_RETURN_POLL_WINDOW_MS = 135_000;

export function isFinalPaymentState(order: StoreOrderStatus): boolean {
  return ['paid', 'payment_review', 'refunded'].includes(order.status)
    || (order.status === 'expired' && !order.preference_id)
    || ['rejected', 'cancelled', 'charged_back'].includes(order.payment_status ?? '');
}

export function nextPaymentPollDelay(order: StoreOrderStatus | null, elapsedMs: number): number | null {
  if (order && isFinalPaymentState(order)) return null;
  return elapsedMs < PAYMENT_RETURN_POLL_WINDOW_MS ? PAYMENT_RETURN_POLL_INTERVAL_MS : null;
}

function statusMessage(order: StoreOrderStatus): string {
  if (order.status === 'paid' && order.payment_status === 'approved') return 'Pago aprobado y registrado por FixPhone.';
  if (order.status === 'payment_review') return 'Mercado Pago aprobó el pago. FixPhone está revisando la disponibilidad del repuesto antes de confirmar la venta.';
  if (order.status === 'refunded' || order.payment_status === 'refunded') return 'El pago fue reembolsado.';
  if (order.status === 'expired' && order.preference_id) return 'La reserva venció, pero seguimos conciliando el pago con Mercado Pago.';
  if (order.status === 'expired') return 'El plazo de esta orden venció. Volvé al carrito para iniciar una nueva compra.';
  if (order.payment_status === 'rejected') return 'Mercado Pago rechazó el pago. Podés volver al carrito e intentarlo otra vez.';
  if (order.payment_status === 'cancelled') return 'El pago fue cancelado. Podés volver al carrito e intentarlo otra vez.';
  if (order.payment_status === 'approved') return 'El pago está aprobado y FixPhone está actualizando la orden.';
  if (['pending', 'in_process', 'authorized'].includes(order.payment_status ?? '')) return 'Mercado Pago todavía está procesando el pago. Esta página seguirá consultando automáticamente.';
  return 'Estamos consultando el estado del pago con FixPhone.';
}

export function StorefrontPaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const { customer, loading: sessionLoading, sessionError } = useStorefrontSession();
  const [order, setOrder] = useState<StoreOrderStatus | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    if (!customer?.id || !orderId) return;
    let active = true;
    let timer: number | undefined;
    const startedAt = Date.now();

    const refresh = async () => {
      setRefreshing(true);
      try {
        const current = await readStoreOrderStatus(orderId);
        if (!active) return;
        setOrder(current);
        setError('');
        const delay = nextPaymentPollDelay(current, Date.now() - startedAt);
        if (delay !== null) timer = window.setTimeout(refresh, delay);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'No se pudo consultar el estado de la orden.');
        const delay = nextPaymentPollDelay(null, Date.now() - startedAt);
        if (delay !== null) timer = window.setTimeout(refresh, delay);
      } finally {
        if (active) setRefreshing(false);
      }
    };

    void refresh();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [customer?.id, orderId, manualRefresh]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">FixPhone · Estado del pago</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Resultado de tu compra</h1>
        {sessionLoading ? <p role="status" className="mt-4 text-sm text-slate-600">Verificando tu sesión…</p> : !customer ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-700">{sessionError || 'Iniciá sesión para consultar el estado de tu orden.'}</p>
            <Link className="inline-flex rounded-full bg-[var(--storefront-primary)] px-4 py-2.5 text-sm font-black text-[var(--storefront-on-primary)]" to="/store/account/sign-in">
              Iniciar sesión
            </Link>
          </div>
        ) : !orderId ? (
          <p role="alert" className="mt-4 text-sm text-rose-700">No recibimos el identificador de la orden. Consultá tu carrito o contactá a FixPhone.</p>
        ) : order ? (
          <div className="mt-4 space-y-3">
            <p role="status" className="text-base font-bold text-slate-800">{statusMessage(order)}</p>
            <p className="text-sm text-slate-600">Orden {order.order_number} · {money(order.currency_code, order.total_amount_minor)}</p>
            {order.payment_status_detail && <p className="text-xs text-slate-500">Detalle: {order.payment_status_detail}</p>}
            {!isFinalPaymentState(order) && <p className="text-xs text-slate-500">La consulta se actualizará automáticamente durante algo más de dos minutos.</p>}
          </div>
        ) : (
          <p role={error ? 'alert' : 'status'} className="mt-4 text-sm text-slate-600">{error || 'Consultando la orden…'}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {customer && orderId && (
            <button
              type="button"
              className="rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-sm font-black text-[var(--storefront-on-primary)] disabled:cursor-wait disabled:opacity-60"
              disabled={refreshing}
              onClick={() => setManualRefresh((value) => value + 1)}
            >
              {refreshing ? 'Actualizando…' : 'Actualizar estado'}
            </button>
          )}
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" to="/store/cart">Volver al carrito</Link>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700" to="/store">Ir a la tienda</Link>
        </div>
      </section>
    </main>
  );
}
