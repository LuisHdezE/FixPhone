import { useState } from 'react';
import { Link } from 'react-router';
import { uploadProductImage } from '../infrastructure/campaignImageUpload';

export function StoreProductImageField({ value, onChange, disabled, onUploadingChange, productLabel }: {
  value: string | null; onChange: (url: string | null) => void;
  disabled: boolean; onUploadingChange: (uploading: boolean) => void; productLabel: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function upload(file: File) {
    setUploading(true); onUploadingChange(true); setError(''); setNotice('');
    try {
      const url = await uploadProductImage(file);
      onChange(url);
      setNotice('Imagen subida a R2. Guardá la ficha para mostrarla en la tienda.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo subir la imagen.');
    } finally { setUploading(false); onUploadingChange(false); }
  }

  return <div className="grid gap-2 rounded border border-slate-200 p-2" data-product-image-field>
    <div className="flex items-center gap-3">
      <div className="grid h-16 w-20 shrink-0 place-items-center rounded bg-slate-50 text-[10px] text-slate-400">
        {value ? <img src={value} alt="Vista previa de la imagen del producto" className="h-full w-full object-contain" /> : 'Sin imagen'}
      </div>
      <div className="min-w-0">
        <label className="grid gap-1 text-[11px]">Imagen principal
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={'Subir imagen de ' + productLabel}
            className="w-full min-w-0 text-[10px] file:mr-2 file:rounded file:border-0 file:bg-red-50 file:px-2 file:py-1 file:text-red-700"
            disabled={disabled || uploading}
            onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file); }} />
        </label>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">{uploading ? 'Preparando y subiendo a R2…' : 'JPG, PNG o WebP hasta 20 MB; se optimiza y elimina metadatos.'}</p>
      </div>
    </div>
    <label className="grid gap-1 text-[11px]">URL HTTPS existente (opcional)
      <input type="url" className="h-7 min-w-0 rounded border border-slate-200 px-2 text-[11px]" value={value ?? ''} disabled={disabled || uploading}
        onChange={event => { onChange(event.target.value || null); setNotice(''); }} />
    </label>
    {notice && <p role="status" className="text-[11px] text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="text-[11px] text-red-700">{error}</p>}
    <Link to="/admin/settings/media-storage" className="w-fit text-[10px] text-slate-500 underline">Configurar almacenamiento R2</Link>
  </div>;
}
