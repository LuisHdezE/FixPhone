import { useEffect, useRef, useState } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import type { DeviceSummary, PromotionalAsset } from '../application/promotionalAssets.types';
import { PromotionalAssetsGateway } from '../infrastructure/PromotionalAssetsGateway';

interface PreparePromotionModalProps {
  inventoryId: string;
  sourcePhotoId: string;
  sourcePhotoUrl: string;
  onClose: () => void;
  onAssetUpdated?: (asset: PromotionalAsset) => void;
  gateway?: PromotionalAssetsGateway;
}

const defaultGateway = new PromotionalAssetsGateway();

export function PreparePromotionModal({
  inventoryId,
  sourcePhotoId,
  sourcePhotoUrl,
  onClose,
  onAssetUpdated,
  gateway = defaultGateway,
}: PreparePromotionModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asset, setAsset] = useState<PromotionalAsset | null>(null);
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onAssetUpdatedRef = useRef(onAssetUpdated);
  onAssetUpdatedRef.current = onAssetUpdated;

  const preparedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const currentKey = `${inventoryId}:${sourcePhotoId}`;
    if (preparedKeyRef.current === currentKey) {
      return;
    }
    preparedKeyRef.current = currentKey;

    let cancelled = false;
    async function init() {
      setLoading(true);
      setError('');
      try {
        const res = await gateway.prepare(inventoryId, sourcePhotoId);
        if (!cancelled) {
          setAsset(res.data);
          setSummary(res.device_summary);
          setWarnings(res.warnings);
          onAssetUpdatedRef.current?.(res.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo preparar la publicidad.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [inventoryId, sourcePhotoId, gateway]);

  async function handleCopyPrompt() {
    if (!asset?.prompt_snapshot) return;
    try {
      await navigator.clipboard.writeText(asset.prompt_snapshot);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleUploadFile(files: FileList | null) {
    if (!files?.length || !asset) return;
    const file = files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('El archivo debe ser JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5 MB.');
      return;
    }

    setUploading(true);
    setError('');
    setActionMessage('');
    try {
      const updated = await gateway.uploadResult(inventoryId, asset.id, file);
      setAsset(updated);
      setActionMessage('Publicidad cargada exitosamente. Podés revisarla y aprobarla.');
      onAssetUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir la imagen generada.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleApprove() {
    if (!asset) return;
    setUploading(true);
    setError('');
    try {
      const updated = await gateway.approve(inventoryId, asset.id);
      setAsset(updated);
      setActionMessage('Publicidad aprobada.');
      onAssetUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar la publicidad.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDiscard() {
    if (!asset) return;
    if (!confirm('¿Descartar esta publicidad? Se liberará el almacenamiento.')) return;
    setUploading(true);
    setError('');
    try {
      const updated = await gateway.discard(inventoryId, asset.id);
      setAsset(updated);
      setActionMessage('Publicidad descartada.');
      onAssetUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descartar la publicidad.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <ModalShell
      title="Preparar publicidad con IA"
      onClose={onClose}
      density="compact"
      width="medium"
    >
      <div className="space-y-3 p-1 text-xs text-slate-800" data-prepare-promotion-modal>
        {/* Explanatory banner */}
        <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-900">
          <p className="font-semibold">Flujo de publicidad manual:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sky-800">
            <li>Copiá el prompt y abrí/descargá la foto real del dispositivo.</li>
            <li>Usá ambos en <strong>ChatGPT</strong> para generar la imagen publicitaria.</li>
            <li>Volvé aquí y cargá el resultado en <em>"Subir publicidad generada"</em>.</li>
          </ol>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-slate-500">Resolviendo datos y preparando prompt...</span>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
            {error}
          </div>
        )}

        {!loading && asset && (
          <div className="grid gap-3 md:grid-cols-2">
            {/* Left side: Photo & Resolved specs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <img
                  src={sourcePhotoUrl}
                  alt="Foto fuente del dispositivo"
                  className="h-20 w-20 rounded border border-slate-300 object-cover bg-white"
                  data-source-photo-img
                />
                <div className="min-w-0 flex-1 space-y-1 text-[11px]">
                  <p className="font-semibold text-slate-900 truncate">
                    {summary?.modelo || 'Dispositivo'}
                  </p>
                  <p className="font-mono text-[10px] text-slate-600">
                    {summary?.codigo_fxp || 'Sin código'}
                  </p>
                  <a
                    href={sourcePhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                    data-open-source-photo
                  >
                    Abrir foto completa ↗
                  </a>
                </div>
              </div>

              {/* Data list */}
              <div className="rounded-md border border-slate-200 bg-white p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Datos autorizados del dispositivo
                </p>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                  <div>
                    <dt className="text-slate-500">Precio:</dt>
                    <dd className="font-medium text-slate-800">
                      {summary?.precio ? `${summary.precio} ${summary.moneda || ''}` : <span className="text-slate-400">Sin precio</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">RAM:</dt>
                    <dd className="font-medium text-slate-800">
                      {summary?.ram || <span className="text-slate-400">No especificada</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Almacenamiento:</dt>
                    <dd className="font-medium text-slate-800">
                      {summary?.almacenamiento || <span className="text-slate-400">No especificado</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Color:</dt>
                    <dd className="font-medium text-slate-800">
                      {summary?.color || <span className="text-slate-400">No especificado</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Condición:</dt>
                    <dd className="font-medium text-slate-800">
                      {summary?.condicion || <span className="text-slate-400">No especificada</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Garantía:</dt>
                    <dd className="font-medium text-slate-800">
                      {summary?.garantia || <span className="text-slate-400">No especificada</span>}
                    </dd>
                  </div>
                  {summary?.defectos && (
                    <div className="col-span-2">
                      <dt className="text-slate-500">Defectos / detalles:</dt>
                      <dd className="font-medium text-amber-800">{summary.defectos}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900" data-warnings-container>
                  <p className="font-semibold">Advertencias de datos faltantes:</p>
                  <ul className="mt-0.5 list-disc pl-4 space-y-0.5 text-amber-800">
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right side: Prompt final & Snapshot */}
            <div className="space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="font-semibold text-slate-900 text-[11px]" data-prompt-version-label>
                    {asset.prompt_code} · v{asset.prompt_version}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyPrompt()}
                    className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-sky-700 transition"
                    data-copy-prompt-button
                  >
                    {copied ? '✓ ¡Copiado!' : '📋 Copiar prompt'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={10}
                  value={asset.prompt_snapshot}
                  className="w-full rounded border border-slate-300 bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-800 focus:outline-none"
                  data-prompt-snapshot-textarea
                />
              </div>

              {/* Result upload & approval block */}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2" data-result-block>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-[11px]">Resultado de la publicidad</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                      asset.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : asset.status === 'uploaded'
                        ? 'bg-amber-100 text-amber-800'
                        : asset.status === 'discarded'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                    data-asset-status-badge
                  >
                    Estado: {asset.status}
                  </span>
                </div>

                {actionMessage && (
                  <p className="text-[10px] font-medium text-emerald-700">{actionMessage}</p>
                )}

                {/* Upload action if prepared */}
                {asset.status === 'prepared' && (
                  <div>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800">
                      <span>📤 Subir publicidad generada</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploading}
                        className="sr-only"
                        onChange={(e) => void handleUploadFile(e.currentTarget.files)}
                        data-upload-result-input
                      />
                    </label>
                    <p className="mt-1 text-[10px] text-slate-500">JPG, PNG o WebP · hasta 5 MB</p>
                  </div>
                )}

                {/* Preview and approve/discard if uploaded or approved */}
                {(asset.status === 'uploaded' || asset.status === 'approved' || asset.status === 'discarded') && asset.image_url && (
                  <div className="space-y-2">
                    <div className="h-32 w-full overflow-hidden rounded border border-slate-300 bg-white flex items-center justify-center">
                      <img
                        src={asset.image_url}
                        alt="Publicidad generada"
                        className="h-full w-full object-contain"
                        data-promotional-preview-img
                      />
                    </div>
                    {asset.status === 'uploaded' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => void handleApprove()}
                          className="flex-1 rounded bg-emerald-600 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 transition"
                          data-approve-button
                        >
                          ✓ Aprobar publicidad
                        </button>
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => void handleDiscard()}
                          className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 transition"
                          data-discard-button
                        >
                          ✕ Descartar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            data-close-modal-button
          >
            Cerrar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
