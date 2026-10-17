<?php
namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Media\VerifiedR2ImageUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StorefrontProductImageController
{
    public function __invoke(Request $request, VerifiedR2ImageUploader $uploader): JsonResponse
    {
        $values = $request->validate([
            'image' => ['required', 'file', 'image', 'mimetypes:image/webp,image/jpeg,image/png',
                'max:2048', 'dimensions:max_width=4096,max_height=4096'],
        ]);
        $url = $uploader->upload($values['image'], 'store/products');
        return response()->json(['data' => ['url' => $url]], 201)->header('Cache-Control', 'no-store');
    }
}
