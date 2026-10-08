<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// cPanel typical layout:
// - public: /home/eliasworks/public_html/fixphone
// - app: /home/eliasworks/fixphone_app
// From public_html/fixphone, the app root is two levels up and then into fixphone_app
$applicationPath = dirname(__DIR__, 2).'/fixphone_app';

if (file_exists($maintenance = $applicationPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $applicationPath.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $applicationPath.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
