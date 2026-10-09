import { useEffect, useRef, useState } from 'react';
import { ValuationPhotosGateway, type UploadStep } from '../infrastructure/ValuationPhotosGateway';
import type { ValuationPhoto } from '../application/valuationPhotos.types';

const gateway = new ValuationPhotosGateway();
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const uploadLabels: Record<UploadStep | 'optimization', string> = {
  optimization: 'Preparando fotografías y quitando metadatos…',
  authorization: 'Solicitando autorización segura a FixPhone…',
  r2: 'Enviando fotografía a Cloudflare R2…',
  fallback: 'La conexión directa falló. Probando transferencia segura desde FixPhone…',
  verification: 'Comprobando que la fotografía llegó correctamente…',
};

async function optimizedPhoto(source: File): Promise<Blob> {
  if (source.size > MAX_SOURCE_BYTES) throw new Error('La imagen original no puede superar 20 MB.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(source.type)) {
    throw new Error('Usá una foto JPEG, PNG o WebP.');
  }

  // Canvas re-encodes the camera image to WebP, removing EXIF metadata
  // (including GPS and device details), while keeping a useful storefront size.
  const image = await createImageBitmap(source);
  try {
    if (image.width < 100 || image.height < 100 || image.width > 12000 || image.height > 12000) {
      throw new Error('La resolución de la foto no es válida.');
    }
    const limit = 1600;
    const ratio = Math.min(1, limit / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tu navegador no permite optimizar fotografías.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encoded = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((file) => file ? resolve(file) : reject(new Error('No fue posible convertir la foto.')), 'image/webp', 0.8);
    });
    if (encoded.type !== 'image/webp' || encoded.size > MAX_BYTES || encoded.size === 0) {
      throw new Error('La foto optimizada supera 5 MB o WebP no está disponible.');
    }
    return encoded;
  } finally {
    image.close();
  }
}

interface Props {
  valuationId: string;
  currentPrimaryUrl: string;
  onPrimaryChange: (url: string) => void;
}

export function ValuationPhotoUpload({ valuationId, currentPrimaryUrl, onPrimaryChange }: Props) {
  const [photos, setPhotos] = useState<ValuationPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<UploadStep | 'optimization'>('optimization');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedNames, setSelectedNames] = useState('');
  const chooser = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPhotos([]);
    setPendingFiles([]);
    setSelectedNames('');
    setError('');
    setMessage('');
    gateway.list(valuationId).then((data) => {
      if (active) setPhotos(data);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la galería.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [valuationId]);

  async function upload(files: File[]) {
    if (!files.length) return;
    setError('');
    setMessage('');
    setPendingFiles([]);
    setSelectedNames(files.map((file) => file.name).join(', '));
    setBusy(true);
    let currentPhotos = [...photos];
    let completed = 0;
    try {
      for (const file of files) {
        if (currentPhotos.length >= 8) throw new Error('Máximo 8 fotografías por equipo.');
        setStep('optimization');
        const cleanImage = await optimizedPhoto(file);
        const saved = await gateway.upload(valuationId, cleanImage, setStep);
        currentPhotos = [...currentPhotos, saved];
        completed++;
        setPhotos(currentPhotos);
        if (!currentPrimaryUrl && currentPhotos.length === 1) {
          onPrimaryChange(saved.url);
        }
      }
      setMessage('¡Listo! ' + completed + ' fotografía(s) confirmada(s) en Cloudflare R2. Podés elegir la imagen principal.');
      setSelectedNames('');
    } catch (reason) {
      const details = reason instanceof Error ? reason.message : 'No se pudo subir la fotografía.';
      setError(details);
      // Confirmation may have failed *after* a successful PUT. Never retry
      // blindly in that case, since it could produce duplicate R2 objects.
      if (!details.startsWith('La fotografía se envió a R2') && !details.startsWith('La foto llegó a R2')) {
        setPendingFiles(files.slice(completed));
      }
    } finally {
      setBusy(false);
      if (chooser.current) chooser.current.value = '';
    }
  }

  async function choosePrimary(photo: ValuationPhoto) {
    setBusy(true); setError(''); setMessage('');
    try {
      const url = await gateway.primary(valuationId, photo.id);
      onPrimaryChange(url);
      setMessage('Fotografía principal actualizada.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo elegir la foto principal.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <h4 className="text-sm font-bold text-slate-900">Fotografías del equipo</h4>
    <p className="mt-1 text-xs leading-5 text-slate-600">Agregá fotos reales desde tu computadora o celular. FixPhone las optimiza en formato WebP, elimina metadatos de la cámara y las guarda en Cloudflare R2. Hasta 8 fotos de 20 MB por archivo original.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input ref={chooser} className="sr-only" type="file" aria-label="Seleccionar fotografías del equipo" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || photos.length >= 8 || loading} onChange={(event) => void upload(Array.from(event.currentTarget.files ?? []))} />
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md bg-[var(--theme-primary)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || loading || photos.length >= 8}
        onClick={() => chooser.current?.click()}
      >
        <span aria-hidden="true">＋</span> {photos.length ? 'Agregar más fotografías' : 'Agregar fotografías'}
      </button>
      <span className="text-xs text-slate-500">{photos.length}/8 fotografías</span>
      {pendingFiles.length && !busy ? (
        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold" type="button" onClick={() => void upload(pendingFiles)}>
          Reintentar {pendingFiles.length === 1 ? 'fotografía' : 'fotografías'}
        </button>
      ) : null}
    </div>
    {selectedNames ? <p className="mt-2 break-words text-xs text-slate-600">Archivos seleccionados: {selectedNames}</p> : null}
    {busy ? <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800" role="status">{uploadLabels[step]}</p> : null}
    {loading ? <p className="mt-3 text-xs">Consultando galería…</p> : null}
    {error ? <p role="alert" className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-800">{error}</p> : null}
    {message ? <p role="status" className="mt-3 rounded bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p> : null}
    {!loading && photos.length === 0 ? <p className="mt-3 text-xs text-slate-500">Todavía no hay fotografías vinculadas.</p> : null}
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {photos.map((photo) => <div key={photo.id} className="rounded border border-slate-200 p-2">
        <img className="aspect-square w-full bg-slate-50 object-contain" src={photo.url} alt="Fotografía del equipo" loading="lazy" />
        <button className="mt-2 w-full rounded border border-slate-200 px-1 py-1 text-[11px] font-semibold disabled:opacity-50" type="button" disabled={busy || currentPrimaryUrl === photo.url} onClick={() => void choosePrimary(photo)}>
          {currentPrimaryUrl === photo.url ? 'Principal ✓' : 'Hacer principal'}
        </button>
      </div>)}
    </div>
  </div>;
}
