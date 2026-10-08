<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Routing\Controller;

class SpaController extends Controller
{
    /**
     * Handle the incoming request and serve the SPA entry point.
     *
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function __invoke(\Illuminate\Http\Request $request)
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            abort(404, 'Not Found');
        }

        $path = public_path('index.html');
        if (!file_exists($path)) {
            abort(404, 'Frontend build not found');
        }

        return response()->file($path);
    }
}
