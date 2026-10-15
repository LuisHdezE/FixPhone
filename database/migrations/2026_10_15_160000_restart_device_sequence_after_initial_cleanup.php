<?php

use App\Infrastructure\Maintenance\DeviceProductionReset;
use App\Infrastructure\Maintenance\DeviceSequenceRestart;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Fresh installs and environments without the authorized cleanup are unaffected.
        if (DB::table('audit_events')->where('event_type', DeviceProductionReset::OPERATION)->exists()) {
            app(DeviceSequenceRestart::class)->run();
        }
    }

    public function down(): void
    {
        // Allocated device identifiers must never change during rollback.
    }
};
