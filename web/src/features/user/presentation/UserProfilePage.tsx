import { AppIcon } from '@/components/AppIcon';
import { KeyValueList } from '@/components/data-display/KeyValueList';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';

const activity = [
  { label: 'Actualizó sus preferencias de notificación', time: 'Hoy, 09:42' },
  { label: 'Completó la verificación de seguridad', time: 'Ayer, 16:18' },
  { label: 'Se incorporó al espacio de trabajo', time: '12 sep 2026' },
];

export function UserProfilePage() {
  return (
    <PageShell
      actions={<button className="rounded-md bg-[var(--theme-primary)] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[var(--theme-primary-hover)]" type="button">Editar perfil</button>}
      breadcrumbs={[{ label: 'Usuario' }, { label: 'Perfil' }]}
      description="Consulta la identidad, actividad y contexto de acceso de la persona dentro del espacio de trabajo."
      title="Perfil de usuario"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <SurfaceCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full bg-[var(--theme-primary-soft)] text-2xl font-semibold text-[var(--theme-primary)]">LH</div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--theme-primary)]">Cuenta activa</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Luis Hernández</h2>
              <p className="mt-1 text-sm text-slate-500">Product designer · WebBlueprint</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Verificado</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Administrador</span>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
            {[['Correo', 'luis@webblueprint.dev'], ['Teléfono', '+52 55 1234 5678'], ['Zona horaria', 'Ciudad de México · UTC−06:00'], ['Miembro desde', 'Septiembre de 2026']].map(([label, value]) => (
              <div key={label} className="rounded-md border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</p>
                <p className="mt-1 text-[12px] font-medium text-slate-800">{value}</p>
              </div>
            ))}
          </div>
         </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"><AppIcon className="size-4" name="settings" /></div>
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">Resumen de acceso</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Estado de la cuenta y seguridad.</p>
            </div>
          </div>
          <div className="mt-5"><KeyValueList items={[['Último acceso', 'Hoy, 09:38'], ['Sesiones activas', '2 dispositivos'], ['Autenticación', '2FA habilitado'], ['Perfil público', 'Visible para el equipo']]} /></div>
       </SurfaceCard>
      </div>

      <SurfaceCard className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">Actividad reciente</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Últimos eventos asociados a este perfil.</p>
          </div>
          <AppIcon className="size-4 text-slate-400" name="chart" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {activity.map((item) => (
            <div key={item.label} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[11px] font-medium leading-4 text-slate-700">{item.label}</p>
              <p className="mt-2 text-[10px] text-slate-400">{item.time}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </PageShell>
  );
}
