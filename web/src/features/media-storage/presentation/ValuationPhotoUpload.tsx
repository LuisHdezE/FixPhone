import { useEffect, useRef, useState } from 'react';
import { ValuationPhotosGateway } from '../infrastructure/ValuationPhotosGateway';
import type { ValuationPhoto } from '../application/valuationPhotos.types';

const gateway = new ValuationPhotosGateway();
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

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
  const chooser = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMessage('');
    gateway.list(valuationId).then((data) => {
      if (active) setPhotos(data);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la galería.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [valuationId]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setMessage('');
    setBusy(true);
    let currentPhotos = [...photos];
    try {
      for (const file of Array.from(files)) {
        if (currentPhotos.length >= 8) throw new Error('Máximo 8 fotografías por equipo.');
        const cleanImage = await optimizedPhoto(file);
        const saved = await gateway.upload(valuationId, cleanImage);
        currentPhotos = [...currentPhotos, saved];
        setPhotos(currentPhotos);
        if (!currentPrimaryUrl && currentPhotos.length === 1) {
          onPrimaryChange(saved.url);
        }
      }
      setMessage('Fotografías guardadas y verificadas en R2. Elegí una imagen principal si lo necesitás.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo subir la fotografía.');
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
    <h4 className="text-xs font-bold text-slate-900">Fotos reales de esta valoración</h4>
    <p className="mt-1 text-[11px] leading-5 text-slate-600">Elegí fotografías de tu equipo. Se optimizan a WebP y se envían directamente a Cloudflare R2. El sistema elimina los metadatos de la cámara. Máximo 8 imágenes; hasta 20 MB por original.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input ref={chooser} className="max-w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || photos.length >= 8} onChange={(event) => void upload(event.currentTarget.files)} />
      {busy ? <span className="text-xs font-semibold">Subiendo y verificando…</span> : null}
    </div>
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
