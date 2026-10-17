import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { canAccessAdministration, safeStoreReturn } from '../infrastructure/storefrontApi';
import { useStorefrontSession } from './useStorefrontSession';

export function StorefrontCustomerIdentityPage({ mode }: { provider: StorefrontProvider; mode: 'sign-in' | 'register' }) {
  const { customer, loading, signIn, signOut } = useStorefrontSession();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeStoreReturn((location.state as { from?: string } | null)?.from);
  const register = mode === 'register';
  const [values, setValues] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await signIn(mode, values); navigate(returnTo, { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-md px-4 py-8" data-storefront-customer-identity>
    <h1 className="text-xl font-bold">{customer ? 'Mi cuenta' : register ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
    <p className="mt-2 text-sm text-slate-600">Podés explorar y consultar sin cuenta. Para agregar productos al carrito, iniciá sesión.</p>
    {loading ? <p role="status" className="mt-4">Comprobando sesión…</p> : customer ? <div className="mt-5 grid gap-3">
      <p>{customer.name} · {customer.email}</p>
      <Link to={returnTo} className="font-semibold text-red-600">Volver a la tienda</Link>
      {canAccessAdministration(customer.permissions) && <Link to="/apps/inventory/dashboard" className="font-semibold text-red-600">Administración</Link>}
      <button type="button" className="text-left text-sm underline" onClick={() => { void signOut().catch(() => setError('La sesión local se cerró.')); }}>Cerrar sesión</button>
    </div> : <form onSubmit={submit} className="mt-5 grid gap-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <fieldset disabled={busy} className="grid gap-4">
        {(register ? ['name', 'email', 'password', 'password_confirmation'] as const : ['email', 'password'] as const).map(field => <label key={field} className="grid gap-1 text-sm">
          {({ name: 'Nombre', email: 'Correo electrónico', password: 'Contraseña', password_confirmation: 'Confirmar contraseña' })[field]}
          <input required type={field === 'email' ? 'email' : field.includes('password') ? 'password' : 'text'}
            autoComplete={field === 'email' ? 'email' : field === 'name' ? 'name' : register ? 'new-password' : 'current-password'}
            minLength={field.includes('password') && register ? 8 : field === 'name' ? 2 : undefined}
            maxLength={field === 'name' ? 120 : field === 'email' ? 255 : 128}
            className="rounded-md border border-slate-300 p-2" value={values[field]}
            onChange={event => setValues(current => ({ ...current, [field]: event.target.value }))} />
        </label>)}
        <button className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white" type="submit">{busy ? 'Procesando…' : register ? 'Crear cuenta' : 'Iniciar sesión'}</button>
      </fieldset>
      <Link className="text-sm font-semibold text-red-600" to={register ? '/store/account/sign-in' : '/store/account/register'} state={{ from: returnTo }}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</Link>
    </form>}
  </section>;
}
