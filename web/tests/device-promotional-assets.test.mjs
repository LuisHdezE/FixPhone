import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('DevicePhotoGallery includes AI promotion action and renders promotional assets section without breaking existing gallery', () => {
  const gallerySource = read('../src/features/inventory/presentation/DevicePhotoGallery.tsx');
  const modalSource = read('../src/features/inventory/presentation/PreparePromotionModal.tsx');
  const gatewaySource = read('../src/features/inventory/infrastructure/PromotionalAssetsGateway.ts');
  const typesSource = read('../src/features/inventory/application/promotionalAssets.types.ts');

  // 1. Action "✨ Publicidad" on confirmed real photos
  assert.match(gallerySource, /data-prepare-ad-button/);
  assert.match(gallerySource, /✨ Publicidad/);
  assert.match(gallerySource, /setAdPhoto\(photo\)/);

  // 2. PreparePromotionModal component exists and opens on action
  assert.match(gallerySource, /<PreparePromotionModal/);
  assert.match(modalSource, /data-prepare-promotion-modal/);
  assert.match(modalSource, /Preparar publicidad con IA/);

  // 3. Render device data in modal
  assert.match(modalSource, /data-source-photo-img/);
  assert.match(modalSource, /data-open-source-photo/);
  assert.match(modalSource, /Datos autorizados del dispositivo/);
  assert.match(modalSource, /summary\?\.precio/);
  assert.match(modalSource, /summary\?\.ram/);
  assert.match(modalSource, /summary\?\.almacenamiento/);
  assert.match(modalSource, /summary\?\.color/);
  assert.match(modalSource, /summary\?\.condicion/);
  assert.match(modalSource, /summary\?\.garantia/);
  assert.match(modalSource, /summary\?\.defectos/);

  // 4. Missing data warnings
  assert.match(modalSource, /data-warnings-container/);
  assert.match(modalSource, /Advertencias de datos faltantes/);

  // 5. PROMPT-0001 + version display and copy button
  assert.match(modalSource, /data-prompt-version-label/);
  assert.match(modalSource, /data-copy-prompt-button/);
  assert.match(modalSource, /data-prompt-snapshot-textarea/);
  assert.match(modalSource, /handleCopyPrompt/);

  // 6. Manual instructions banner
  assert.match(modalSource, /Flujo de publicidad manual/);
  assert.match(modalSource, /ChatGPT/);

  // 7. Upload generated result, approve and discard actions
  assert.match(modalSource, /data-upload-result-input/);
  assert.match(modalSource, /Subir publicidad generada/);
  assert.match(modalSource, /data-promotional-preview-img/);
  assert.match(modalSource, /data-approve-button/);
  assert.match(modalSource, /data-discard-button/);
  assert.match(modalSource, /data-asset-status-badge/);

  // 8. Gateway methods
  assert.match(gatewaySource, /async list\(/);
  assert.match(gatewaySource, /async prepare\(/);
  assert.match(gatewaySource, /async uploadResult\(/);
  assert.match(gatewaySource, /async approve\(/);
  assert.match(gatewaySource, /async discard\(/);

  // 9. Types definition
  assert.match(typesSource, /export type PromotionalAssetStatus = 'prepared' \| 'uploaded' \| 'approved' \| 'discarded'/);
  assert.match(typesSource, /export interface PromotionalAsset/);
  assert.match(typesSource, /export interface DeviceSummary/);

  // 10. Existing gallery controls preserved
  assert.match(gallerySource, /data-device-photo-gallery/);
  assert.match(gallerySource, /data-device-photo-card/);
  assert.match(gallerySource, /Marcar principal/);
  assert.match(gallerySource, /Mover izquierda/);
  assert.match(gallerySource, /Mover derecha/);
  assert.match(gallerySource, /Eliminar/);
});

test('PromotionalAssetsGateway routes adhere strictly to API conventions', () => {
  const gatewaySource = read('../src/features/inventory/infrastructure/PromotionalAssetsGateway.ts');

  assert.match(gatewaySource, /\/api\/v1\/admin\/inventory\/\$\{encodeURIComponent\(inventoryId\)\}\/promotional-assets/);
  assert.match(gatewaySource, /\/prepare/);
  assert.match(gatewaySource, /\/presign/);
  assert.match(gatewaySource, /\/confirm/);
  assert.match(gatewaySource, /\/approve/);
  assert.match(gatewaySource, /\/discard/);
});
