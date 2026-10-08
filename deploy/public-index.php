<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// cPanel typical layout:
// - /home/username/fixphone_app
// - /home/username/public_html
// From public_html, the app root is one level up and then into fixphone_app
$applicationPath = dirname(__DIR__, 1).'/fixphone_app';

// If deployed as subdomain or custom directory, it's typically:
// - /home/username/fixphone_app
// - /home/username/fixphone.eliasworks.uy
// So __DIR__ is /home/username/fixphone.eliasworks.uy
// dirname(__DIR__, 1) is /home/username
// Thus $applicationPath is /home/username/fixphone_app

if (file_exists($maintenance = $applicationPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $applicationPath.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $applicationPath.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
