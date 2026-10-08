<?php

use Illuminate\Support\Facades\Route;
use App\Presentation\Http\Controllers\SpaController;

Route::fallback(SpaController::class);
