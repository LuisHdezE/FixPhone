<?php
use Illuminate\Support\Facades\Artisan;
Artisan::command('fixphone:about', function (): void { $this->info('FixPhone API foundation is installed.'); });
