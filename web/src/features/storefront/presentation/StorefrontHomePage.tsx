import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';

export function StorefrontHomePage({ provider: _provider }: { provider: StorefrontProvider }) {
  const waLink = "https://wa.me/59800000000";

  return (
    <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-8 sm:px-5 lg:px-8 lg:py-12" data-storefront-home>
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-90" />
        <div className="relative z-10 flex min-h-[400px] flex-col justify-center px-8 py-12 sm:px-12 lg:px-20">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">Tu celular como nuevo</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Expertos en Reparación y <br className="hidden sm:block" /> Venta de Celulares
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Reparaciones rápidas, desbloqueos, celulares usados seleccionados y testeados, repuestos de calidad y garantía comprobada.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
            >
              Contacto rápido por WhatsApp
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center justify-center rounded-full bg-white/10 px-8 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
            >
              Ver servicios
            </a>
          </div>
        </div>
      </section>

      <section id="servicios" className="grid gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Servicios Principales</h2>
          <p className="mt-2 text-slate-600">Soluciones integrales para tu dispositivo</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Reparación de Celulares', desc: 'Pantallas, baterías, pines de carga y micro soldadura.' },
            { title: 'Desbloqueos', desc: 'Liberaciones de red y software rápido y seguro.' },
            { title: 'Presupuesto sin Costo', desc: 'Revisamos tu equipo y te damos un diagnóstico gratis.' }
          ].map(s => (
             <article key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[var(--storefront-primary)] hover:shadow-md">
               <h3 className="text-xl font-bold text-slate-900">{s.title}</h3>
               <p className="mt-3 text-slate-600">{s.desc}</p>
             </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col justify-center rounded-3xl bg-slate-50 p-8 sm:p-12">
          <h3 className="text-2xl font-black text-slate-900">Celulares Usados Seleccionados</h3>
          <p className="mt-4 text-slate-600">Equipos 100% testeados, libres de fábrica y con garantía. La mejor relación calidad-precio.</p>
          <Link to="/store/used-phones" className="mt-8 w-fit rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">Ver catálogo de equipos</Link>
        </div>
        <div className="flex flex-col justify-center rounded-3xl bg-slate-50 p-8 sm:p-12">
          <h3 className="text-2xl font-black text-slate-900">Repuestos Originales y AAA</h3>
          <p className="mt-4 text-slate-600">Pantallas, baterías, flex y más para todas las marcas. Venta al público y técnicos.</p>
          <Link to="/store/spare-parts" className="mt-8 w-fit rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">Ver repuestos</Link>
        </div>
      </section>

      <section className="grid gap-8 border-t border-slate-200 pt-12 md:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Por qué confiar en FixPhone</h2>
          <ul className="mt-6 space-y-4">
            {['Técnicos especializados con años de experiencia', 'Garantía real en todas nuestras reparaciones y ventas', 'Transparencia total en precios y diagnósticos', 'Repuestos de la más alta calidad del mercado'].map(item => (
              <li key={item} className="flex items-start gap-3 text-slate-700">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--storefront-primary-soft)] text-[10px] text-[var(--storefront-primary-strong)]">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Cómo Trabajamos</h2>
          <div className="mt-6 space-y-6">
            {[
              { step: '1', title: 'Contacto / Recepción', desc: 'Escribinos o traé tu equipo a nuestro local.' },
              { step: '2', title: 'Diagnóstico Sin Costo', desc: 'Evaluamos el problema y te pasamos presupuesto exacto.' },
              { step: '3', title: 'Reparación', desc: 'Si aceptás, reparamos tu equipo en tiempo récord.' },
              { step: '4', title: 'Entrega y Garantía', desc: 'Te devolvemos tu celular funcionando con su garantía.' }
            ].map(item => (
              <div key={item.step} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 font-black text-white">{item.step}</span>
                <div>
                  <h4 className="font-bold text-slate-900">{item.title}</h4>
                  <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-[var(--storefront-primary-strong)] p-8 text-center text-[var(--storefront-on-primary)] sm:p-16">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">¿Necesitás ayuda con tu celular?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">Escribinos ahora por WhatsApp y te respondemos a la brevedad. Tu solución está a un mensaje de distancia.</p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-8 inline-flex items-center justify-center rounded-full bg-[#25D366] px-8 py-4 text-base font-bold text-white shadow-xl transition hover:scale-105"
        >
          Iniciar chat en WhatsApp
        </a>
      </section>
    </div>
  );
}
