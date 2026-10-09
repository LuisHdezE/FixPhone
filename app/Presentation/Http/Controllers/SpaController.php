<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Valuation\PublishedPartsDonor;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SpaController extends Controller
{
    /**
     * Serve SPA. Individual public device URLs receive server-rendered OpenGraph
     * metadata so Facebook and chat previews can describe the actual listing.
     */
    public function __invoke(Request $request)
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            abort(404, 'Not Found');
        }

        $path = public_path('index.html');
        if (!file_exists($path)) {
            abort(404, 'Frontend build not found');
        }

        if ($request->is('store/for-parts/*')) {
            $id = $request->segment(3);
            $item = $id ? PublishedPartsDonor::query()->find($id) : null;
            if ($item) {
                $title = htmlspecialchars($item->model_name.' para repuestos | FixPhone', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $description = htmlspecialchars(mb_substr(strip_tags($item->public_description), 0, 220), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $image = htmlspecialchars($item->public_image_url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $canonical = htmlspecialchars(url('/store/for-parts/'.$item->id), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

                $tags = '<meta property="og:type" content="product" />'
                    .'<meta property="og:title" content="'.$title.'" />'
                    .'<meta property="og:description" content="'.$description.'" />'
                    .'<meta property="og:image" content="'.$image.'" />'
                    .'<meta property="og:url" content="'.$canonical.'" />'
                    .'<meta name="twitter:card" content="summary_large_image" />'
                    .'<link rel="canonical" href="'.$canonical.'" />';

                $html = str_replace('</head>', $tags.'</head>', file_get_contents($path));
                return response($html, 200)
                    ->header('Content-Type', 'text/html; charset=UTF-8')
                    ->header('Cache-Control', 'no-store');
            }
        }

        return response()->file($path);
    }
}
