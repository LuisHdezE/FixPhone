import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { adminToken } from '@/auth/adminApiSession';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import type { MediaStorageProfile, MediaStorageProfileInput } from '../application/mediaStorage.types';
import { MediaStorageSettingsGateway } from '../infrastructure/MediaStorageSettingsGateway';

type ProfileDraft = {
  name: string;
  bucket: string;
  endpoint: string;
  publicUrl: string;
  prefix: string;
  accessKey: string;
  secretKey: string;
};

const gateway = new MediaStorageSettingsGateway();
const emptyDraft: ProfileDraft = {
  name: '', bucket: '', endpoint: '', publicUrl: '', prefix: 'media',
  accessKey: '', secretKey: '',
};
const field = 'h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[var(--theme-primary)]';
const caption = 'grid gap-1 text-[11px] font-semibold text-slate-600';
const button = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50';

function forEdit(profile: MediaStorageProfile): ProfileDraft {
  return {
    name: profile.name, bucket: profile.bucket, endpoint: profile.endpoint_url,
    publicUrl: profile.public_base_url ?? '', prefix: profile.object_prefix,
    accessKey: '', secretKey: '',
  };
}

export function MediaStorageSettingsPage() {
  const [profiles, setProfiles] = useState<MediaStorageProfile[]>([]);
  const [environment, setEnvironment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const hasSession = Boolean(adminToken());

  const refresh = useCallback(async () => {
    try {
      const result = await gateway.list();
      setProfiles(result.data);
      setEnvironment(result.environment);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasSession) void refresh();
    else setLoading(false);
  }, [hasSession, refresh]);

  function change<K extends keyof ProfileDraft>(name: K, value: ProfileDraft[K]) {
    setForm((old) => ({ ...old, [name]: value }));
    setNotice('');
  }

  function newProfile() {
    setEditingId(null);
    setForm(emptyDraft);
    setNotice('');
    setError('');
  }

  function edit(profile: MediaStorageProfile) {
    setEditingId(profile.id);
    setForm(forEdit(profile));
    setNotice('');
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const data: MediaStorageProfileInput = {
      name: form.name.trim(), provider: 'r2', bucket: form.bucket.trim(),
      endpoint_url: form.endpoint.trim(), public_base_url: form.publicUrl.trim() || null,
      object_prefix: form.prefix.trim(),
    };
    if (form.accessKey.trim()) data.access_key_id = form.accessKey.trim();
    if (form.secretKey.trim()) data.secret_access_key = form.secretKey.trim();
    try {
      const profile = await gateway.save(data, editingId ?? undefined);
      setEditingId(profile.id);
      setForm(forEdit(profile));
      setNotice('Perfil guardado. Aún no se ha comprobado la conexión ni se ha subido ninguna fotografía.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el perfil.');
    } finally {
      setBusy(false);
    }
  }

  async function selectProfile(profile: MediaStorageProfile) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await gateway.select(profile.id);
      await refresh();
      setNotice('Perfil preferido actualizado para esta instalación. La conexión todavía no ha sido probada.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo seleccionar el perfil.');
    } finally {
      setBusy(false);
    }
  }

  return <PageShell title="Almacenamiento de imágenes" description="Conexiones R2 configurables por instalación, sin direcciones ni credenciales hardcodeadas." breadcrumbs={[{ label: 'Administración' }, { label: 'Almacenamiento de imágenes' }]}>
    {!hasSession ? <SurfaceCard>
      <p className="text-xs text-slate-600">Iniciá sesión con permisos para administrar integraciones.</p>
      <Link className="mt-2 inline-block rounded-md bg-[var(--theme-primary)] px-3 py-2 text-xs font-semibold text-white" to="/authentication/sign-in" state={{ from: '/admin/settings/media-storage' }}>Iniciar sesión</Link>
    </SurfaceCard> : <div className="grid gap-3">
      {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">{notice}</p> : null}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
        Esta pantalla guarda los perfiles en forma segura. <strong>No realiza todavía subidas de fotos ni comprueba la conexión.</strong> El siguiente módulo de carga usará el perfil seleccionado. Las fotografías existentes no cambian de ubicación automáticamente.
      </div>
      <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SurfaceCard>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Perfiles de esta instalación</h2>
            <button className={button} type="button" onClick={newProfile}>Nuevo</button>
          </div>
          {environment ? <p className="mb-3 text-[11px] text-slate-500">Entorno Laravel: {environment}</p> : null}
          {loading ? <p className="text-xs text-slate-500">Cargando…</p> : null}
          {!loading && profiles.length === 0 ? <p className="text-xs text-slate-500">Todavía no existe ningún perfil de almacenamiento.</p> : null}
          <div className="grid gap-2">
            {profiles.map((profile) => <div key={profile.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="text-xs text-slate-900">{profile.name}</strong>
                {profile.is_selected ? <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold">Preferido</span> : null}
              </div>
              <p className="mt-1 break-all text-[11px] text-slate-500">R2 · {profile.bucket}</p>
              <p className="mt-1 text-[11px] text-slate-500">{profile.has_credentials ? 'Credenciales cifradas guardadas' : 'Credenciales pendientes'}</p>
              <p className="text-[11px] text-slate-500">Conexión: sin comprobar</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={button} type="button" onClick={() => edit(profile)}>Editar</button>
                {!profile.is_selected ? <button className={button} disabled={busy || !profile.has_credentials || !profile.public_base_url} type="button" onClick={() => void selectProfile(profile)}>Elegir</button> : null}
              </div>
            </div>)}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-sm font-bold">{editingId ? 'Editar conexión R2' : 'Nueva conexión R2'}</h2>
          <p className="mt-1 text-xs text-slate-500">Configuración privada por instalación. Cada cliente debe proporcionar sus propias credenciales para producción.</p>
          <form className="mt-3 grid gap-3" onSubmit={(event) => void save(event)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={caption}>Nombre del perfil
                <input className={field} required maxLength={120} value={form.name} placeholder="Ej.: R2 desarrollo" onChange={(e) => change('name', e.target.value)} />
              </label>
              <label className={caption}>Proveedor
                <input className={field} value="Cloudflare R2 (S3-compatible)" disabled readOnly />
              </label>
              <label className={caption}>Bucket
                <input className={field} required maxLength={63} value={form.bucket} placeholder="Nombre del contenedor" onChange={(e) => change('bucket', e.target.value)} />
              </label>
              <label className={caption}>Prefijo de archivos
                <input className={field} required maxLength={160} value={form.prefix} placeholder="media" onChange={(e) => change('prefix', e.target.value)} />
              </label>
            </div>
            <label className={caption}>Endpoint privado de API S3 · Cuenta Cloudflare
              <input className={field} required type="url" value={form.endpoint} placeholder="https://CUENTA.r2.cloudflarestorage.com" onChange={(e) => change('endpoint', e.target.value)} />
              <span className="font-normal text-slate-500">Copiá el endpoint de R2 sin agregar /nombre-del-bucket. No es la dirección pública de fotografías.</span>
            </label>
            <label className={caption}>URL pública de imágenes (opcional hasta habilitar la publicación)
              <input className={field} type="url" value={form.publicUrl} placeholder="https://pub-....r2.dev o https://imagenes.ejemplo.com" onChange={(e) => change('publicUrl', e.target.value)} />
              <span className="font-normal text-slate-500">Debe servir imágenes públicamente por HTTPS. No es necesario cambiar DNS para guardar un perfil.</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={caption}>Access Key ID
                <input className={field} type="password" autoComplete="new-password" value={form.accessKey} placeholder={editingId ? 'En blanco: conservar la actual' : 'Clave de acceso restringida'} onChange={(e) => change('accessKey', e.target.value)} />
              </label>
              <label className={caption}>Secret Access Key
                <input className={field} type="password" autoComplete="new-password" value={form.secretKey} placeholder={editingId ? 'En blanco: conservar la actual' : 'Clave secreta restringida'} onChange={(e) => change('secretKey', e.target.value)} />
              </label>
            </div>
            <p className="text-[11px] leading-5 text-slate-600">Estas claves se envían al backend por HTTPS y se cifran con la clave de la aplicación. Nunca vuelven a mostrarse en el formulario ni se guardan en el navegador. Usá credenciales con acceso limitado al bucket, sin permisos generales sobre tu cuenta.</p>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className="rounded-md bg-[var(--theme-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" type="submit">{busy ? 'Guardando…' : 'Guardar perfil'}</button>
              {editingId ? <button className={button} type="button" onClick={newProfile}>Crear otro perfil</button> : null}
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>}
  </PageShell>;
}
