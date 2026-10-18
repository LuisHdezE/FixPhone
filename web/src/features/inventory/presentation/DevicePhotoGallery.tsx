import { useCallback, useEffect, useRef, useState } from 'react';
import type { DevicePhoto } from '../application/devicePhotos.types';
import type { PromotionalAsset, PromotionalAssetsSummary } from '../application/promotionalAssets.types';
import { DevicePhotosGateway } from '../infrastructure/DevicePhotosGateway';
import { PromotionalAssetsGateway } from '../infrastructure/PromotionalAssetsGateway';
import { PreparePromotionModal } from './PreparePromotionModal';

const gateway = new DevicePhotosGateway();
const promoGateway = new PromotionalAssetsGateway();

export function DevicePhotoGallery({ inventoryId }: { inventoryId: string }) {
  const [photos, setPhotos] = useState<DevicePhoto[]>([]);
  const [promoAssets, setPromoAssets] = useState<PromotionalAsset[]>([]);
  const [promoSummary, setPromoSummary] = useState<PromotionalAssetsSummary | null>(null);
  const [cleaningEmpty, setCleaningEmpty] = useState(false);
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);
  const [cleanMessage, setCleanMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [adPhoto, setAdPhoto] = useState<DevicePhoto | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [devicePhotos, promoRes] = await Promise.all([
        gateway.list(inventoryId),
        promoGateway.list(inventoryId).catch(() => ({
          data: [],
          summary: { total: 0, prepared: 0, uploaded: 0, approved: 0, discarded: 0, empty_prepared: 0 },
        })),
      ]);
      setPhotos(devicePhotos);
      setPromoAssets(promoRes.data || []);
      setPromoSummary(promoRes.summary || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la galería.');
    }
  }, [inventoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        if (photos.length >= 8) break;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          throw new Error('Cada foto debe ser JPG, PNG o WebP y pesar hasta 5 MB.');
        }
        await gateway.upload(inventoryId, file);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function primary(id: string) {
    setBusy(true);
    try {
      await gateway.primary(inventoryId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la principal.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta foto del dispositivo?')) return;
    setBusy(true);
    try {
      await gateway.remove(inventoryId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la foto.');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    setBusy(true);
    try {
      setPhotos(await gateway.reorder(inventoryId, next.map((p) => p.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ordenar la galería.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const handleClosePromotion = useCallback(() => {
    setAdPhoto(null);
    void load();
  }, [load]);

  const handleAssetUpdated = useCallback((_updated: PromotionalAsset) => {
    void load();
  }, [load]);

  const handleCleanEmptyPrepared = useCallback(async () => {
    setCleaningEmpty(true);
    setError('');
    setCleanMessage('');
    try {
      const res = await promoGateway.deleteEmptyPrepared(inventoryId);
      setConfirmCleanOpen(false);
      setCleanMessage(`${res.deleted_count} preparaciones vacías eliminadas.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron eliminar las preparaciones vacías.');
    } finally {
      setCleaningEmpty(false);
    }
  }, [inventoryId, load]);

  return (
    <fieldset className="min-w-0 border-0 border-t border-slate-100 p-0 pt-2" data-device-photo-gallery>
      <div className="mb-2 flex items-center justify-between gap-2">
        <legend className="text-[11px] font-semibold text-slate-900">
          Fotos reales del equipo <span className="font-normal text-slate-500">({photos.length}/8)</span>
        </legend>
        <label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50">
          + Añadir fotos
          <input
            ref={input}
            className="sr-only"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || photos.length >= 8}
            onChange={(e) => void upload(e.currentTarget.files)}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="rounded bg-slate-50 p-2 text-[10px] text-slate-500">
          Todavía no hay fotos reales. La tienda puede usar la imagen de referencia del modelo como respaldo.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <div key={photo.id} className="relative overflow-hidden rounded-md border border-slate-200 bg-white" data-device-photo-card={photo.id}>
              <button
                type="button"
                className="block h-24 w-full bg-slate-50"
                onClick={() => setPreview(photo.url)}
              >
                <img src={photo.url} alt={'Foto real ' + (i + 1)} className="h-full w-full object-contain" />
              </button>
              {photo.is_primary && (
                <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] text-white">
                  Principal
                </span>
              )}
              <div className="flex items-center justify-between border-t p-1">
                <button
                  type="button"
                  title="Preparar publicidad con IA"
                  disabled={busy}
                  onClick={() => setAdPhoto(photo)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 transition"
                  data-prepare-ad-button={photo.id}
                >
                  ✨ Publicidad
                </button>
                <div className="flex items-center gap-1">
                  {!photo.is_primary && (
                    <button
                      type="button"
                      title="Marcar principal"
                      disabled={busy}
                      onClick={() => void primary(photo.id)}
                      className="px-1 text-[10px]"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    title="Mover izquierda"
                    disabled={busy || i === 0}
                    onClick={() => void move(i, -1)}
                    className="px-1 text-[10px]"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    title="Mover derecha"
                    disabled={busy || i === photos.length - 1}
                    onClick={() => void move(i, 1)}
                    className="px-1 text-[10px]"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    disabled={busy}
                    onClick={() => void remove(photo.id)}
                    className="px-1 text-[10px] text-red-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotional assets section if any exist */}
      {(promoAssets.length > 0 || (promoSummary && promoSummary.total > 0)) && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2" data-promotional-assets-section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                Publicidades IA generadas
              </p>
              {promoSummary && (
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-slate-500" data-promo-summary-counters>
                  <span className="font-semibold text-slate-700">Total: {promoSummary.total}</span>
                  {promoSummary.approved > 0 && (
                    <span className="rounded bg-emerald-100 px-1 font-semibold text-emerald-800">
                      {promoSummary.approved} aprobada{promoSummary.approved === 1 ? '' : 's'}
                    </span>
                  )}
                  {promoSummary.uploaded > 0 && (
                    <span className="rounded bg-amber-100 px-1 font-semibold text-amber-800">
                      {promoSummary.uploaded} cargada{promoSummary.uploaded === 1 ? '' : 's'}
                    </span>
                  )}
                  {promoSummary.prepared > 0 && (
                    <span className="rounded bg-slate-200 px-1 font-medium text-slate-700">
                      {promoSummary.prepared} preparada{promoSummary.prepared === 1 ? '' : 's'}
                    </span>
                  )}
                  {promoSummary.discarded > 0 && (
                    <span className="rounded bg-rose-100 px-1 font-medium text-rose-800">
                      {promoSummary.discarded} descartada{promoSummary.discarded === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Clean empty preparations button if any empty prepared exists */}
            {promoSummary && promoSummary.empty_prepared > 0 && (
              <button
                type="button"
                className="rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400"
                onClick={() => setConfirmCleanOpen(true)}
                data-clean-empty-promotions-button
              >
                🗑 Eliminar preparaciones vacías ({promoSummary.empty_prepared})
              </button>
            )}
          </div>

          {cleanMessage && (
            <div
              className="mb-2 flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800"
              data-clean-empty-feedback
            >
              <span>{cleanMessage}</span>
              <button
                type="button"
                className="ml-2 text-emerald-600 hover:text-emerald-900"
                onClick={() => setCleanMessage('')}
              >
                ✕
              </button>
            </div>
          )}

          {promoSummary && promoSummary.total > promoAssets.length && (
            <p className="mb-2 text-[9px] italic text-slate-500">
              Mostrando las {promoAssets.length} publicidades principales priorizadas de {promoSummary.total}.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {promoAssets.map((asset) => (
              <div
                key={asset.id}
                className="overflow-hidden rounded border border-slate-200 bg-white p-1 text-[10px]"
                data-promotional-asset-card={asset.id}
              >
                {asset.image_url ? (
                  <button
                    type="button"
                    className="block h-20 w-full overflow-hidden rounded bg-slate-100"
                    onClick={() => setPreview(asset.image_url)}
                  >
                    <img
                      src={asset.image_url}
                      alt="Publicidad generada"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ) : (
                  <div className="flex h-20 w-full items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                    Sin imagen cargada
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className={`rounded px-1 text-[8px] font-semibold ${
                      asset.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : asset.status === 'uploaded'
                        ? 'bg-amber-100 text-amber-800'
                        : asset.status === 'discarded'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {asset.status === 'approved'
                      ? 'Aprobada'
                      : asset.status === 'uploaded'
                      ? 'Cargada'
                      : asset.status === 'discarded'
                      ? 'Descartada'
                      : 'Preparada'}
                  </span>
                  <span className="font-mono text-[8px] text-slate-500">
                    {asset.prompt_code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1 text-[10px] text-slate-500">
        {busy ? 'Procesando…' : 'JPG, PNG o WebP · máximo 5 MB por foto.'}
      </p>
      {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="Vista ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded bg-white object-contain"
          />
        </div>
      )}

      {confirmCleanOpen && promoSummary && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
          data-confirm-clean-modal
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">
              ¿Eliminar preparaciones vacías?
            </h3>
            <p className="mt-2 text-xs text-slate-600">
              Se eliminarán <strong>{promoSummary.empty_prepared}</strong> preparaciones sin imagen de este dispositivo.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Las publicidades cargadas o aprobadas no serán afectadas.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setConfirmCleanOpen(false)}
                disabled={cleaningEmpty}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void handleCleanEmptyPrepared()}
                disabled={cleaningEmpty}
                data-confirm-clean-submit-button
              >
                {cleaningEmpty ? 'Eliminando...' : 'Eliminar preparaciones vacías'}
              </button>
            </div>
          </div>
        </div>
      )}

      {adPhoto && (
        <PreparePromotionModal
          inventoryId={inventoryId}
          sourcePhotoId={adPhoto.id}
          sourcePhotoUrl={adPhoto.url}
          onClose={handleClosePromotion}
          onAssetUpdated={handleAssetUpdated}
        />
      )}
    </fieldset>
  );
}