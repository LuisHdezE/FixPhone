<?php

use Illuminate\Support\Facades\Route;
use App\Presentation\Http\Controllers\SpaController;

Route::redirect('/', '/store');
Route::fallback(SpaController::class);
