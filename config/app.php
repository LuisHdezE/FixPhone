<?php
return [
  'name'=>env('APP_NAME','FixPhone'),'env'=>env('APP_ENV','production'),'debug'=>(bool)env('APP_DEBUG',false),
  'url'=>env('APP_URL','http://localhost'),'timezone'=>'America/Montevideo','locale'=>env('APP_LOCALE','es'),
  'fallback_locale'=>env('APP_FALLBACK_LOCALE','es'),'faker_locale'=>'es_ES','cipher'=>'AES-256-CBC','key'=>env('APP_KEY'),
  'previous_keys'=>array_filter(explode(',',(string)env('APP_PREVIOUS_KEYS',''))),
  'maintenance'=>['driver'=>env('APP_MAINTENANCE_DRIVER','file'),'store'=>env('APP_MAINTENANCE_STORE','database')],
  'demo_seeder_enabled' => env('APP_DEMO_SEEDER_ENABLED', false),
  'demo_seeder_allowed_databases' => array_filter(explode(',', (string) env('APP_DEMO_SEEDER_ALLOWED_DATABASES', ''))),
];
