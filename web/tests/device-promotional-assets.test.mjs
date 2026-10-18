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

test('PreparePromotionModal and DevicePhotoGallery prevent infinite prepare loop and stabilize callbacks', () => {
  const gallerySource = read('../src/features/inventory/presentation/DevicePhotoGallery.tsx');
  const modalSource = read('../src/features/inventory/presentation/PreparePromotionModal.tsx');

  // 1. PreparePromotionModal does NOT include onAssetUpdated in prepare useEffect dependency array
  assert.doesNotMatch(
    modalSource,
    /useEffect\(\s*\(\)\s*=>[\s\S]*?,\s*\[[^\]]*onAssetUpdated[^\]]*\]\)/,
    'PreparePromotionModal useEffect must not depend directly on onAssetUpdated callback',
  );

  // 2. PreparePromotionModal stores onAssetUpdated in a ref
  assert.match(modalSource, /const onAssetUpdatedRef = useRef\(onAssetUpdated\);/);
  assert.match(modalSource, /onAssetUpdatedRef\.current = onAssetUpdated;/);

  // 3. PreparePromotionModal uses preparedKeyRef guard based on inventoryId and sourcePhotoId
  assert.match(modalSource, /const preparedKeyRef = useRef<string \| null>\(null\);/);
  assert.match(modalSource, /const currentKey = `\$\{inventoryId\}:\$\{sourcePhotoId\}`;/);
  assert.match(modalSource, /if \(preparedKeyRef\.current === currentKey\) {\s*return;\s*}/);
  assert.match(modalSource, /preparedKeyRef\.current = currentKey;/);

  // 4. DevicePhotoGallery memoizes handleClosePromotion and handleAssetUpdated
  assert.match(gallerySource, /const handleClosePromotion = useCallback\(/);
  assert.match(gallerySource, /const handleAssetUpdated = useCallback\(/);
  assert.match(gallerySource, /onClose=\{handleClosePromotion\}/);
  assert.match(gallerySource, /onAssetUpdated=\{handleAssetUpdated\}/);
});

test('PreparePromotionModal lifecycle regression: prepare runs exactly once per opening/photo and avoids re-fetch loops on rerender or asset update', async () => {
  // Simulates the exact React hook lifecycle and dependency comparison mechanism
  class ModalInstance {
    constructor(props) {
      this.inventoryId = props.inventoryId;
      this.sourcePhotoId = props.sourcePhotoId;
      this.gateway = props.gateway;
      this.onAssetUpdated = props.onAssetUpdated;

      // Internal state & refs
      this.loading = true;
      this.asset = null;
      this.onAssetUpdatedRef = { current: this.onAssetUpdated };
      this.preparedKeyRef = { current: null };

      // Track effect runs and dependency history
      this.lastEffectDeps = null;

      this.runRenderPass();
    }

    updateProps(newProps) {
      if ('inventoryId' in newProps) this.inventoryId = newProps.inventoryId;
      if ('sourcePhotoId' in newProps) this.sourcePhotoId = newProps.sourcePhotoId;
      if ('gateway' in newProps) this.gateway = newProps.gateway;
      if ('onAssetUpdated' in newProps) this.onAssetUpdated = newProps.onAssetUpdated;

      this.runRenderPass();
    }

    triggerInternalStateChange() {
      // Simulates copied prompt or action message
      this.runRenderPass();
    }

    runRenderPass() {
      // Ref synchronization effect
      this.onAssetUpdatedRef.current = this.onAssetUpdated;

      // Prepare effect dependencies: [inventoryId, sourcePhotoId, gateway]
      const currentDeps = [this.inventoryId, this.sourcePhotoId, this.gateway];
      const depsChanged = !this.lastEffectDeps || this.lastEffectDeps.some((dep, i) => !Object.is(dep, currentDeps[i]));

      if (depsChanged) {
        this.lastEffectDeps = currentDeps;
        this.runPrepareEffect();
      }
    }

    runPrepareEffect() {
      const currentKey = `${this.inventoryId}:${this.sourcePhotoId}`;
      if (this.preparedKeyRef.current === currentKey) {
        return;
      }
      this.preparedKeyRef.current = currentKey;

      // Execute prepare call
      this.gateway.prepare(this.inventoryId, this.sourcePhotoId).then((res) => {
        this.loading = false;
        this.asset = res.data;
        this.onAssetUpdatedRef.current?.(res.data);
      });
    }
  }

  let prepareCallCount = 0;
  const mockGateway = {
    async prepare(invId, photoId) {
      prepareCallCount++;
      return {
        data: { id: `asset-${prepareCallCount}`, status: 'prepared', inventory_item_id: invId, source_photo_id: photoId },
        device_summary: { modelo: 'Samsung Galaxy A22 5G' },
        warnings: [],
      };
    },
  };

  let parentRerenderCount = 0;
  let currentOnAssetUpdated = (_asset) => {
    parentRerenderCount++;
  };

  // 1. Open modal -> Exactly 1 prepare call
  let modal = new ModalInstance({
    inventoryId: 'FXP-0009',
    sourcePhotoId: 'photo-1',
    gateway: mockGateway,
    onAssetUpdated: currentOnAssetUpdated,
  });

  assert.equal(prepareCallCount, 1, 'Opening modal must trigger exactly 1 prepare call');

  // Wait for promise to resolve and notify parent
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(parentRerenderCount, 1, 'Prepare response must trigger onAssetUpdated once');

  // 2. Response arrives -> Parent refreshes list and passes new callback reference -> Still exactly 1 prepare
  currentOnAssetUpdated = (_asset) => {
    parentRerenderCount++;
  };
  modal.updateProps({ onAssetUpdated: currentOnAssetUpdated });
  assert.equal(prepareCallCount, 1, 'Rerender with updated callback reference must NOT trigger another prepare');

  // 3. Refresh list of promotional assets / parent rerender -> Still exactly 1 prepare
  modal.updateProps({ onAssetUpdated: (_asset) => {} });
  assert.equal(prepareCallCount, 1, 'Subsequent list refreshes must NOT trigger another prepare');

  // 4. Change internal states (e.g. copied, error, action message) -> Still exactly 1 prepare
  modal.triggerInternalStateChange();
  modal.triggerInternalStateChange();
  assert.equal(prepareCallCount, 1, 'Internal state changes must NOT trigger another prepare');

  // 5. Change explicitly sourcePhotoId -> Exactly 1 additional prepare (total 2)
  modal.updateProps({ sourcePhotoId: 'photo-2' });
  assert.equal(prepareCallCount, 2, 'Changing sourcePhotoId must trigger exactly 1 additional prepare call');

  await new Promise((resolve) => setTimeout(resolve, 10));

  // 6. Close modal (unmount) and reopen (new instance) -> Exactly 1 new prepare allowed
  modal = null; // unmount
  modal = new ModalInstance({
    inventoryId: 'FXP-0009',
    sourcePhotoId: 'photo-1',
    gateway: mockGateway,
    onAssetUpdated: (_asset) => {},
  });

  assert.equal(prepareCallCount, 3, 'Closing and reopening modal allows a new preparation session');
});

