import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { TextField } from '@/components/forms/TextField';
import { PageShell } from '@/shell/PageShell';

const settings = [
  { title: 'Notificaciones por correo', description: 'Recibe actividad y resúmenes del espacio de trabajo.', enabled: true },
  { title: 'Resumen semanal', description: 'Un resumen cada lunes con los cambios más relevantes.', enabled: false },
  { title: 'Sesiones nuevas', description: 'Avisa cuando tu cuenta se usa desde un dispositivo nuevo.', enabled: true },
];

export function AccountSettingsPage() {
  return <PageShell breadcrumbs={[{ label: 'Usuario' }, { label: 'Configuración de cuenta' }]} description="Administra tus datos básicos, preferencias de comunicación y controles de seguridad." title="Configuración de cuenta">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <SurfaceCard><h2 className="text-[13px] font-semibold text-slate-900">Información personal</h2><p className="mt-1 text-[11px] text-slate-500">Estos datos se muestran en tu perfil dentro del equipo.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><TextField defaultValue="Luis Hernández" label="Nombre" /><TextField defaultValue="usuario@fixphone.local" label="Correo" type="email" /><TextField defaultValue="Administrador" label="Cargo" /><TextField defaultValue="FixPhone" label="Organización" /></div></SurfaceCard>
      <SurfaceCard><h2 className="text-[13px] font-semibold text-slate-900">Seguridad</h2><p className="mt-1 text-[11px] text-slate-500">Mantén tus métodos de acceso bajo control.</p><div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-emerald-100 bg-emerald-50/60 p-3"><div><p className="text-[11px] font-semibold text-emerald-800">Autenticación de dos factores</p><p className="mt-1 text-[10px] text-emerald-700">Protección activa en esta cuenta.</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Activa</span></div><p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">La gestión de contraseña se habilitará al conectar el servicio de cuenta.</p></SurfaceCard>
    </div>
    <SurfaceCard className="mt-3"><h2 className="text-[13px] font-semibold text-slate-900">Preferencias de comunicación</h2><div className="mt-4 divide-y divide-slate-100">{settings.map((item) => <label key={item.title} className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><span><span className="block text-[11px] font-semibold text-slate-800">{item.title}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.description}</span></span><input aria-label={item.title} className="size-4 accent-[var(--theme-primary)]" defaultChecked={item.enabled} type="checkbox" /></label>)}</div></SurfaceCard>
  </PageShell>;
}
