import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('campaign image preparation validates source and produces a bounded WebP without upscaling', async () => {
  const server = await createServer({ server: { middlewareMode:true, hmr:false }, appType:'custom' });
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  try {
    const { prepareCampaignImage } = await server.ssrLoadModule('/src/features/storefront/infrastructure/campaignImageUpload.ts');
    await assert.rejects(prepareCampaignImage({type:'image/svg+xml',size:100}),/JPG, PNG o WebP/);
    await assert.rejects(prepareCampaignImage({type:'image/png',size:21*1024*1024}),/20 MB/);
    let closed = 0; let canvas;
    globalThis.createImageBitmap = async () => ({width:4000,height:1000,close(){closed++;}});
    globalThis.document = {createElement(name) {
      assert.equal(name,'canvas');
      canvas = {width:0,height:0,getContext:()=>({drawImage(){}}),toBlob(callback,type){callback(new Blob(['safe pixels'],{type}));}};
      return canvas;
    }};
    const blob = await prepareCampaignImage({type:'image/jpeg',size:100});
    assert.equal(blob.type,'image/webp');
    assert.equal(canvas.width,2048); assert.equal(canvas.height,512); assert.equal(closed,1);
    globalThis.createImageBitmap = async () => ({width:600,height:200,close(){closed++;}});
    await prepareCampaignImage({type:'image/png',size:100});
    assert.equal(canvas.width,600); assert.equal(canvas.height,200); assert.equal(closed,2);
    globalThis.createImageBitmap = async () => ({width:50,height:50,close(){closed++;}});
    await assert.rejects(prepareCampaignImage({type:'image/png',size:100}),/100 × 100/);
    assert.equal(closed,3);
  } finally {
    globalThis.createImageBitmap = originalBitmap; globalThis.document = originalDocument;
    await server.close();
  }
});
