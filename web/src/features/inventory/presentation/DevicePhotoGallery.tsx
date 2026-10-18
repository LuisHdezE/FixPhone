import { useEffect,useRef,useState } from 'react';
import type { DevicePhoto } from '../application/devicePhotos.types';
import { DevicePhotosGateway } from '../infrastructure/DevicePhotosGateway';

const gateway=new DevicePhotosGateway();
export function DevicePhotoGallery({inventoryId}:{inventoryId:string}){
 const [photos,setPhotos]=useState<DevicePhoto[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<string|null>(null);const input=useRef<HTMLInputElement>(null);
 async function load(){try{setPhotos(await gateway.list(inventoryId));}catch(e){setError(e instanceof Error?e.message:'No se pudo cargar la galería.');}}
 useEffect(()=>{void load();},[inventoryId]);
 async function upload(files:FileList|null){if(!files?.length)return;setBusy(true);setError('');try{for(const file of Array.from(files)){if(photos.length>=8)break;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Cada foto debe ser JPG, PNG o WebP y pesar hasta 5 MB.');await gateway.upload(inventoryId,file);}await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo subir la foto.');}finally{setBusy(false);if(input.current)input.current.value='';}}
 async function primary(id:string){setBusy(true);try{await gateway.primary(inventoryId,id);await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo cambiar la principal.');}finally{setBusy(false);}}
 async function remove(id:string){if(!confirm('¿Eliminar esta foto del dispositivo?'))return;setBusy(true);try{await gateway.remove(inventoryId,id);await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar la foto.');}finally{setBusy(false);}}
 async function move(index:number,delta:number){const target=index+delta;if(target<0||target>=photos.length)return;const next=[...photos];[next[index],next[target]]=[next[target],next[index]];setBusy(true);try{setPhotos(await gateway.reorder(inventoryId,next.map(p=>p.id)));}catch(e){setError(e instanceof Error?e.message:'No se pudo ordenar la galería.');await load();}finally{setBusy(false);}}
 return <fieldset className="min-w-0 border-0 border-t border-slate-100 p-0 pt-2" data-device-photo-gallery>
  <div className="mb-2 flex items-center justify-between gap-2"><legend className="text-[11px] font-semibold text-slate-900">Fotos reales del equipo <span className="font-normal text-slate-500">({photos.length}/8)</span></legend>
   <label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50">+ Añadir fotos<input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||photos.length>=8} onChange={e=>void upload(e.currentTarget.files)}/></label>
  </div>
  {photos.length===0?<p className="rounded bg-slate-50 p-2 text-[10px] text-slate-500">Todavía no hay fotos reales. La tienda puede usar la imagen de referencia del modelo como respaldo.</p>:
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.map((photo,i)=><div key={photo.id} className="relative overflow-hidden rounded-md border border-slate-200 bg-white">
   <button type="button" className="block h-24 w-full bg-slate-50" onClick={()=>setPreview(photo.url)}><img src={photo.url} alt={'Foto real '+(i+1)} className="h-full w-full object-contain"/></button>
   {photo.is_primary&&<span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] text-white">Principal</span>}
   <div className="flex items-center justify-center gap-1 border-t p-1">
    {!photo.is_primary&&<button type="button" title="Marcar principal" disabled={busy} onClick={()=>void primary(photo.id)} className="px-1 text-[10px]">★</button>}
    <button type="button" title="Mover izquierda" disabled={busy||i===0} onClick={()=>void move(i,-1)} className="px-1 text-[10px]">←</button>
    <button type="button" title="Mover derecha" disabled={busy||i===photos.length-1} onClick={()=>void move(i,1)} className="px-1 text-[10px]">→</button>
    <button type="button" title="Eliminar" disabled={busy} onClick={()=>void remove(photo.id)} className="px-1 text-[10px] text-red-700">✕</button>
   </div></div>)}</div>}
  <p className="mt-1 text-[10px] text-slate-500">{busy?'Procesando…':'JPG, PNG o WebP · máximo 5 MB por foto.'}</p>
  {error&&<p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
  {preview&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4" onClick={()=>setPreview(null)}><img src={preview} alt="Vista ampliada" className="max-h-[90vh] max-w-[90vw] rounded bg-white object-contain"/></div>}
 </fieldset>;
}