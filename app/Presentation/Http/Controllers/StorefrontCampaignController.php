<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class StorefrontCampaignController extends Controller
{
    public function index(): JsonResponse
    {
        $row = DB::table('storefront_campaigns')->where('id', 1)->first();
        return response()->json(['data' => $row ? ['slides' => json_decode($row->slides, true, 512, JSON_THROW_ON_ERROR)] : null])
            ->header('Cache-Control', 'no-store');
    }

    public function update(Request $request): JsonResponse
    {
        $values = $request->validate([
            'slides' => ['present', 'array', 'list', 'max:8'],
            'slides.*' => ['array:id,eyebrow,title,description,actionLabel,actionHref,image'],
            'slides.*.id' => ['required', 'string', 'max:80', 'distinct', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'slides.*.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'slides.*.title' => ['required', 'string', 'max:100'],
            'slides.*.description' => ['present', 'nullable', 'string', 'max:220'],
            'slides.*.actionLabel' => ['required', 'string', 'max:40'],
            'slides.*.actionHref' => ['required', 'string', 'max:500', 'regex:~^/store(?:[/?#]|$)[^\\\\\\r\\n]*$~'],
            'slides.*.image' => ['required', 'array:src,alt,objectPosition'],
            'slides.*.image.src' => ['required', 'string', 'max:2000'],
            'slides.*.image.alt' => ['required', 'string', 'max:180'],
            'slides.*.image.objectPosition' => ['sometimes', 'string', 'in:center,top,bottom,left,right'],
        ]);
        foreach ($values['slides'] as $index => &$slide) {
            $src = $slide['image']['src'];
            $local = preg_match('~^/(?:assets|images)/[a-zA-Z0-9_./-]+$~D', $src) && !str_contains($src, '..');
            $parts = parse_url($src);
            $remote = filter_var($src, FILTER_VALIDATE_URL) && ($parts['scheme'] ?? '') === 'https'
                && !isset($parts['user']) && !isset($parts['pass']);
            if (!$local && !$remote) {
                throw ValidationException::withMessages(["slides.$index.image.src" => 'Usá una URL pública HTTPS o una imagen de la tienda.']);
            }
            $slide['eyebrow'] ??= '';
            $slide['description'] ??= '';
        }
        unset($slide);
        $now = now();
        DB::table('storefront_campaigns')->upsert([[
            'id' => 1, 'slides' => json_encode($values['slides'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'created_at' => $now, 'updated_at' => $now,
        ]], ['id'], ['slides', 'updated_at']);
        return $this->index();
    }
}
