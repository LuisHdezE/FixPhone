<?php

namespace App\Presentation\Http\Controllers;

use App\Application\PromotionalAssets\DevicePromptVariableResolver;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\InventoryItemPhoto;
use App\Infrastructure\Media\InventoryItemPromotionalAsset;
use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class InventoryItemPromotionalAssetsController extends Controller
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const MIMES = [
        'image/webp' => 'webp',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    private function item(string $id): InventoryItem
    {
        $item = InventoryItem::query()->findOrFail($id);
        abort_unless(in_array($item->item_type, ['used_phone', 'device'], true), 404);
        return $item;
    }

    public function index(string $id): JsonResponse
    {
        $this->item($id);

        $assets = InventoryItemPromotionalAsset::query()
            ->with(['sourcePhoto'])
            ->where('inventory_item_id', $id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $assets->map(fn (InventoryItemPromotionalAsset $asset) => $asset->publicData()),
        ]);
    }

    public function prepare(Request $request, string $id, DevicePromptVariableResolver $resolver): JsonResponse
    {
        $item = $this->item($id);

        $data = $request->validate([
            'source_photo_id' => ['required', 'string'],
        ]);

        $sourcePhotoId = $data['source_photo_id'];

        // Strict ownership & validity check: source photo must belong to this specific device and be confirmed
        $photo = InventoryItemPhoto::query()
            ->where('inventory_item_id', $id)
            ->where('status', 'confirmed')
            ->find($sourcePhotoId);

        if (!$photo) {
            $existsElsewhere = InventoryItemPhoto::query()->whereKey($sourcePhotoId)->exists();
            if ($existsElsewhere) {
                throw ValidationException::withMessages([
                    'source_photo_id' => 'La fotografía fuente pertenece a otro dispositivo.',
                ]);
            }

            throw ValidationException::withMessages([
                'source_photo_id' => 'La fotografía fuente no existe o no está confirmada.',
            ]);
        }

        // Fetch active PROMPT-0001 from database
        $prompt = DB::table('ai_prompts')->where('code', 'PROMPT-0001')->first();
        if (!$prompt) {
            throw ValidationException::withMessages([
                'prompt' => 'El prompt maestro PROMPT-0001 no existe en el catálogo.',
            ]);
        }

        if (!is_null($prompt->archived_at)) {
            throw ValidationException::withMessages([
                'prompt' => 'El prompt maestro PROMPT-0001 se encuentra inactivo/archivado.',
            ]);
        }

        $resolution = $resolver->resolve($item);
        $snapshot = $resolver->applyTemplate($prompt->content, $resolution['variables']);
        $promptVersion = $prompt->version ?? '1.0';

        // Idempotency guard: reuse active 'prepared' asset for the same device, photo and prompt version
        $existing = InventoryItemPromotionalAsset::query()
            ->where('inventory_item_id', $id)
            ->where('source_photo_id', $photo->id)
            ->where('prompt_code', $prompt->code)
            ->where('prompt_version', $promptVersion)
            ->where('status', 'prepared')
            ->latest('created_at')
            ->first();

        if ($existing) {
            $existing->update([
                'ai_prompt_id' => $prompt->id,
                'prompt_snapshot' => $snapshot,
            ]);

            return response()->json([
                'data' => $existing->fresh(['sourcePhoto'])->publicData(),
                'device_summary' => $resolution['summary'],
                'warnings' => $resolution['warnings'],
            ], 200);
        }

        $asset = InventoryItemPromotionalAsset::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $id,
            'source_photo_id' => $photo->id,
            'ai_prompt_id' => $prompt->id,
            'prompt_code' => $prompt->code,
            'prompt_version' => $promptVersion,
            'prompt_snapshot' => $snapshot,
            'status' => 'prepared',
            'created_by' => (string) $request->user()?->getAuthIdentifier(),
        ]);

        return response()->json([
            'data' => $asset->fresh(['sourcePhoto'])->publicData(),
            'device_summary' => $resolution['summary'],
            'warnings' => $resolution['warnings'],
        ], 201);
    }

    public function presign(Request $request, string $id, string $assetId, R2Presigner $signer): JsonResponse
    {
        $this->item($id);

        $asset = InventoryItemPromotionalAsset::query()
            ->where('inventory_item_id', $id)
            ->findOrFail($assetId);

        if ($asset->status === 'approved') {
            throw ValidationException::withMessages([
                'asset' => 'No se puede modificar una publicidad que ya ha sido aprobada.',
            ]);
        }

        $v = $request->validate([
            'content_type' => ['required', Rule::in(array_keys(self::MIMES))],
            'byte_size' => ['required', 'integer', 'min:1', 'max:' . self::MAX_BYTES],
        ]);

        $profile = MediaStorageProfile::query()->where('is_selected', true)->first();
        if (!$profile || !filled($profile->public_base_url) || !filled($profile->access_key_id_encrypted) || !filled($profile->secret_access_key_encrypted)) {
            throw ValidationException::withMessages([
                'image' => 'Configurá y seleccioná un perfil de almacenamiento R2.',
            ]);
        }

        $prefix = trim((string) $profile->object_prefix, '/');
        // Independent storage key distinct from documental photos
        $key = ($prefix === '' ? '' : $prefix . '/') . 'inventory/devices/' . $id . '/promotional/' . $assetId . '.' . self::MIMES[$v['content_type']];
        $url = rtrim((string) $profile->public_base_url, '/') . '/' . implode('/', array_map('rawurlencode', explode('/', $key)));

        $signed = $signer->signedUrl(
            $profile->endpoint_url,
            $profile->bucket,
            $key,
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'PUT',
            180,
            $v['content_type']
        );

        $asset->update([
            'media_storage_profile_id' => $profile->id,
            'object_key' => $key,
            'image_url' => $url,
            'mime_type' => $v['content_type'],
            'size_bytes' => $v['byte_size'],
        ]);

        return response()->json([
            'data' => [
                'asset_id' => $assetId,
                'upload_url' => $signed,
                'content_type' => $v['content_type'],
            ],
        ], 200)->header('Cache-Control', 'no-store');
    }

    public function confirm(string $id, string $assetId, R2Presigner $signer): JsonResponse
    {
        $this->item($id);

        $asset = InventoryItemPromotionalAsset::query()
            ->where('inventory_item_id', $id)
            ->findOrFail($assetId);

        if ($asset->status === 'uploaded' || $asset->status === 'approved') {
            return response()->json(['data' => $asset->fresh(['sourcePhoto'])->publicData()]);
        }

        if (!$asset->object_key || !$asset->media_storage_profile_id || !$asset->size_bytes || !$asset->mime_type) {
            throw ValidationException::withMessages([
                'image' => 'No se ha iniciado la autorización de subida a R2.',
            ]);
        }

        $profile = MediaStorageProfile::query()->findOrFail($asset->media_storage_profile_id);
        $head = $signer->signedUrl(
            $profile->endpoint_url,
            $profile->bucket,
            $asset->object_key,
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'HEAD',
            60
        );

        try {
            $res = Http::timeout(12)->withoutRedirecting()->head($head);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['image' => 'No se pudo verificar la imagen en R2.']);
        }

        if (
            !$res->successful()
            || filter_var($res->header('Content-Length'), FILTER_VALIDATE_INT) === false
            || (int) $res->header('Content-Length') !== $asset->size_bytes
            || strtolower(trim(explode(';', $res->header('Content-Type', ''))[0])) !== $asset->mime_type
        ) {
            throw ValidationException::withMessages(['image' => 'La imagen no pudo verificarse en R2 o difiere en tamaño/formato.']);
        }

        $asset->status = 'uploaded';
        $asset->save();

        return response()->json(['data' => $asset->fresh(['sourcePhoto'])->publicData()]);
    }

    public function approve(Request $request, string $id, string $assetId): JsonResponse
    {
        $this->item($id);

        $asset = InventoryItemPromotionalAsset::query()
            ->where('inventory_item_id', $id)
            ->findOrFail($assetId);

        if ($asset->status !== 'uploaded' && $asset->status !== 'approved') {
            throw ValidationException::withMessages([
                'asset' => 'Solo se pueden aprobar publicidades que hayan sido subidas previamente.',
            ]);
        }

        if ($asset->status !== 'approved') {
            $asset->status = 'approved';
            $asset->approved_by = (string) $request->user()?->getAuthIdentifier();
            $asset->approved_at = now();
            $asset->save();
        }

        return response()->json(['data' => $asset->fresh(['sourcePhoto'])->publicData()]);
    }

    public function discard(string $id, string $assetId, R2Presigner $signer): JsonResponse
    {
        $this->item($id);

        $asset = InventoryItemPromotionalAsset::query()
            ->where('inventory_item_id', $id)
            ->findOrFail($assetId);

        // Delete from R2 to prevent dangling storage waste if already uploaded
        if ($asset->object_key && $asset->media_storage_profile_id) {
            $profile = MediaStorageProfile::query()->find($asset->media_storage_profile_id);
            if ($profile) {
                try {
                    $deleteUrl = $signer->signedUrl(
                        $profile->endpoint_url,
                        $profile->bucket,
                        $asset->object_key,
                        Crypt::decryptString($profile->access_key_id_encrypted),
                        Crypt::decryptString($profile->secret_access_key_encrypted),
                        'DELETE',
                        60
                    );
                    Http::timeout(12)->withoutRedirecting()->delete($deleteUrl);
                } catch (\Throwable) {
                    // Safe cleanup failure handling
                }
            }
        }

        $asset->status = 'discarded';
        $asset->save();

        return response()->json(['data' => $asset->fresh(['sourcePhoto'])->publicData()]);
    }
}
